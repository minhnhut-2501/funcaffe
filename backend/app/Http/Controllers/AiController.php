<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use App\Models\Cafe;
use App\Models\Order;
use App\Services\GeminiService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use MongoDB\BSON\UTCDateTime;
use Throwable;

/**
 * Trợ lý AI cho chủ quán: chat hỏi đáp + phân tích doanh thu.
 * Quyền dùng do middleware 'ai' (RequiresAI) chặn — controller lo ngữ cảnh + gọi Gemini.
 * Số liệu doanh thu do BE tự tính, AI chỉ diễn giải (tránh AI bịa số).
 */
class AiController extends Controller
{
    use ChecksCafeOwnership;

    public function __construct(private GeminiService $gemini)
    {
        $this->middleware('auth:sanctum');
    }

    /** POST cafes/{cafe}/ai/chat */
    public function chat(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $validated = $request->validate([
            'messages'                 => 'required|array|min:1|max:30',
            'messages.*.role'          => 'required|string|in:user,assistant',
            'messages.*.content'       => 'required|string|max:4000',
        ]);

        try {
            $reply = $this->gemini->chat($validated['messages'], $this->cafeContext($cafe));
            return response()->json(['reply' => $reply]);
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    /** POST cafes/{cafe}/ai/chat/stream — trả text dần cho hiệu ứng gõ chữ */
    public function chatStream(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $validated = $request->validate([
            'messages'           => 'required|array|min:1|max:30',
            'messages.*.role'    => 'required|string|in:user,assistant',
            'messages.*.content' => 'required|string|max:4000',
        ]);

        $system = $this->cafeContext($cafe);
        $messages = $validated['messages'];

        return response()->stream(function () use ($messages, $system) {
            // Tắt output buffering để chunk ra ngay
            while (ob_get_level() > 0) {
                ob_end_flush();
            }
            try {
                $this->gemini->streamChat($messages, $system, function ($text) {
                    echo $text;
                    flush();
                });
            } catch (Throwable $e) {
                echo "\n⚠️ " . $e->getMessage();
                flush();
            }
        }, 200, [
            'Content-Type'      => 'text/plain; charset=utf-8',
            'Cache-Control'     => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /** POST cafes/{cafe}/ai/revenue-analysis */
    public function revenueAnalysis(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        // Cache theo quán 1 giờ: bấm lại không gọi Gemini (tiết kiệm & nhanh).
        $cacheKey = "ai_revenue_analysis_{$cafe->id}";
        if (!$request->boolean('refresh') && Cache::has($cacheKey)) {
            return response()->json(Cache::get($cacheKey) + ['cached' => true]);
        }

        $stats = $this->buildRevenueStats($cafe);

        if ($stats['invoice_count'] === 0) {
            return response()->json([
                'message' => 'Chưa có dữ liệu bán hàng để phân tích.',
            ], 422);
        }

        $system = 'Bạn là chuyên gia phân tích kinh doanh quán cà phê ở Việt Nam. '
            . 'Phân tích số liệu doanh thu được cung cấp và trả lời NGẮN GỌN, THỰC TẾ bằng tiếng Việt. '
            . 'Chỉ dựa trên số liệu đưa ra, không bịa thêm số. Tiền tệ là VND.';

        $prompt = "Số liệu doanh thu quán \"{$cafe->name}\":\n"
            . json_encode($stats, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $schema = [
            'type' => 'object',
            'properties' => [
                'tom_tat'          => ['type' => 'string'],
                'diem_noi_bat'     => ['type' => 'array', 'items' => ['type' => 'string']],
                'canh_bao'         => ['type' => 'array', 'items' => ['type' => 'string']],
                'goi_y_hanh_dong'  => ['type' => 'array', 'items' => ['type' => 'string']],
            ],
            'required' => ['tom_tat', 'diem_noi_bat', 'canh_bao', 'goi_y_hanh_dong'],
        ];

        try {
            $result = $this->gemini->generateJson($prompt, $system, $schema);
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        $payload = ['analysis' => $result, 'stats' => $stats];
        Cache::put($cacheKey, $payload, now()->addHour());

        return response()->json($payload + ['cached' => false]);
    }

    /** Ngữ cảnh quán cho chat: tên, menu, số bàn, doanh thu hôm nay. */
    private function cafeContext(Cafe $cafe): string
    {
        $items = $cafe->items()->get(['name', 'base_price', 'is_available']);
        $menu = $items->map(function ($it) {
            $price = number_format((float) ($it->base_price ?? 0), 0, ',', '.');
            $status = ($it->is_available ?? true) ? '' : ' (đang ẩn)';
            return "- {$it->name}: {$price}đ{$status}";
        })->implode("\n");

        $tableCount = $cafe->tables()->count();
        $todayRevenue = $this->sumPaid($cafe, Carbon::today(), Carbon::tomorrow());

        return "Bạn là trợ lý AI cho quán cà phê \"{$cafe->name}\". "
            . "Trả lời ngắn gọn, thân thiện bằng tiếng Việt. Tiền tệ là VND.\n\n"
            . "Thông tin quán:\n"
            . "- Số bàn: {$tableCount}\n"
            . "- Doanh thu hôm nay: " . number_format($todayRevenue, 0, ',', '.') . "đ\n"
            . "- Thực đơn (" . $items->count() . " món):\n{$menu}";
    }

    /** Gom số liệu doanh thu (chỉ hóa đơn đã thanh toán, loại hoàn tiền). */
    private function buildRevenueStats(Cafe $cafe): array
    {
        // Tổng và số hóa đơn TOÀN THỜI GIAN tính bằng phép gộp ở CSDL — không cần
        // nạp document nào về PHP cho hai con số này.
        $total = (int) $this->paidOrders($cafe)->sum('total_amount');
        $invoiceCount = $this->paidOrders($cafe)->count();

        // Phần chi tiết (theo tháng / theo ngày / top món) chỉ cần 12 THÁNG gần đây:
        // kết quả trả về chỉ lấy 6 tháng và 30 ngày cuối. Nạp cả lịch sử kèm dòng món
        // để rồi cắt bớt là chỗ tốn kém nhất của endpoint này.
        $since = Carbon::now()->subMonths(12)->startOfMonth();
        $invoices = $this->paidOrders($cafe)
            ->where(function ($q) use ($since) {
                $q->where('paid_at', '>=', $since)
                  ->orWhere(fn ($q2) => $q2->whereNull('paid_at')->where('created_at', '>=', $since));
            })
            ->with('orderDetails')
            ->get();

        $byMonth = [];
        $byDay = [];
        $topItems = [];

        foreach ($invoices as $inv) {
            $amount = (int) ($inv->total_amount ?? 0);
            $date = $this->toCarbon($inv->paid_at ?? $inv->created_at);
            if ($date) {
                $mKey = $date->format('Y-m');
                $dKey = $date->format('Y-m-d');
                $byMonth[$mKey] = ($byMonth[$mKey] ?? 0) + $amount;
                $byDay[$dKey] = ($byDay[$dKey] ?? 0) + $amount;
            }

            foreach ($inv->orderDetails as $detail) {
                $name = $detail->item_name_snapshot ?? 'Khác';
                $qty = (int) ($detail->quantity ?? 0);
                $rev = (int) ($detail->total_price ?? (($detail->unit_price ?? 0) * $qty));
                if (!isset($topItems[$name])) {
                    $topItems[$name] = ['name' => $name, 'count' => 0, 'revenue' => 0];
                }
                $topItems[$name]['count'] += $qty;
                $topItems[$name]['revenue'] += $rev;
            }
        }

        ksort($byMonth);
        ksort($byDay);
        usort($topItems, fn($a, $b) => $b['revenue'] <=> $a['revenue']);

        // So sánh tháng này vs tháng trước
        $thisMonth = Carbon::now()->format('Y-m');
        $lastMonth = Carbon::now()->subMonth()->format('Y-m');

        return [
            'total_revenue'   => $total,
            'invoice_count'   => $invoiceCount,
            'revenue_by_month'=> array_slice($byMonth, -6, 6, true),
            'revenue_by_day'  => array_slice($byDay, -30, 30, true),
            'top_items'       => array_slice(array_values($topItems), 0, 8),
            'this_month'      => $byMonth[$thisMonth] ?? 0,
            'last_month'      => $byMonth[$lastMonth] ?? 0,
        ];
    }

    /**
     * Doanh thu trong một khoảng, LỌC Ở CSDL.
     *
     * Hàm này chạy mỗi lần người dùng gửi một tin nhắn cho trợ lý AI (qua
     * cafeContext), mà nó chỉ cần tổng tiền của ĐÚNG MỘT NGÀY. Trước đây nó lấy
     * toàn bộ đơn đã thanh toán từ ngày khai trương về rồi lọc bằng PHP.
     */
    private function sumPaid(Cafe $cafe, Carbon $from, Carbon $to): int
    {
        return (int) $this->paidOrders($cafe)
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('paid_at', [$from, $to])
                  // Đơn cũ có thể thiếu paid_at (trước khi trường này được ghi);
                  // với chúng thì ngày tạo là mốc duy nhất bám được.
                  ->orWhere(fn ($q2) => $q2->whereNull('paid_at')->whereBetween('created_at', [$from, $to]));
            })
            ->sum('total_amount');
    }

    /** Truy vấn gốc cho mọi thống kê doanh thu: chỉ đơn đã thu tiền. */
    private function paidOrders(Cafe $cafe)
    {
        return Order::where('cafe_id', $cafe->id)
            ->where('status', 'paid')
            ->where('payment_status', 'paid');
    }

    private function toCarbon($date): ?Carbon
    {
        if (!$date) {
            return null;
        }
        if ($date instanceof Carbon) {
            return $date;
        }
        if ($date instanceof UTCDateTime) {
            return Carbon::instance($date->toDateTime());
        }
        try {
            return Carbon::parse((string) $date);
        } catch (Throwable) {
            return null;
        }
    }
}
