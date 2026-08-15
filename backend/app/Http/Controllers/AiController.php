<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use App\Models\Cafe;
use App\Models\Order;
use App\Services\GeminiService;
use App\Services\RevenueStats;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Trợ lý AI cho chủ quán: chat hỏi đáp + phân tích doanh thu.
 * Quyền dùng do middleware 'ai' (RequiresAI) chặn — controller lo ngữ cảnh + gọi Gemini.
 * Số liệu doanh thu do BE tự tính, AI chỉ diễn giải (tránh AI bịa số).
 */
class AiController extends Controller
{
    use ChecksCafeOwnership;

    public function __construct(
        private GeminiService $gemini,
        private RevenueStats $revenueStats,
    ) {
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

    /**
     * GET cafes/{cafe}/ai/suggestions — câu gợi ý mở đầu, chọn theo tình trạng THẬT.
     *
     * Trước đây frontend ghi cứng ba câu, trong đó có câu hỏi về số bàn — mà chính
     * ngữ cảnh gửi cho Gemini lại không có số liệu đó, nên bấm vào là AI đoán bừa.
     * Sinh ở backend vì đây là nơi biết trạng thái quán, và cũng là nơi dựng ngữ
     * cảnh — hai bên khớp nhau thì không còn cảnh gợi ý hỏi thứ AI không trả lời được.
     */
    public function suggestions(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        [$serving, $empty] = $this->tableOccupancy($cafe);
        $todayRevenue = $this->sumPaid($cafe, Carbon::today(), Carbon::tomorrow());
        $hasSales = $this->paidOrders($cafe)->exists();

        $suggestions = [];

        if ($serving > 0) {
            $suggestions[] = 'Hiện có mấy bàn đang phục vụ, mấy bàn trống?';
        } elseif ($empty > 0) {
            $suggestions[] = 'Cả quán đang trống, tôi nên làm gì để kéo khách lúc này?';
        }

        if ($todayRevenue <= 0 && $hasSales) {
            $suggestions[] = 'Hôm nay chưa có đơn nào, so với mọi hôm thì thế nào?';
        } elseif ($todayRevenue > 0) {
            $suggestions[] = 'Doanh thu hôm nay so với tháng này ra sao?';
        }

        if ($hasSales) {
            $suggestions[] = 'Món nào đang bán chạy nhất, món nào ế?';
        }

        // Câu chốt luôn có mặt: quán mới tinh chưa có dữ liệu gì thì ba nhánh trên
        // đều rỗng, không thể để người dùng mở widget ra và thấy trống trơn.
        $suggestions[] = 'Gợi ý combo cho buổi chiều ế khách';

        return response()->json(['suggestions' => array_slice($suggestions, 0, 3)]);
    }

    /**
     * Ngữ cảnh quán cho chat.
     *
     * Hàm này chạy MỖI LẦN người dùng gửi một tin nhắn, nên được chia làm hai phần
     * với hai vòng đời khác nhau:
     *
     *  - Phần SỐNG (bàn, doanh thu hôm nay): tính lại mỗi lượt. Đây chính là những
     *    con số người dùng vừa bấm để hỏi, lệch một nhịp là họ thấy AI nói khác lưới
     *    bàn đang mở ngay bên cạnh. Cả hai truy vấn đều rẻ và đã có chỉ mục.
     *  - Phần NẶNG (thực đơn, thống kê bán hàng): nhớ tạm 10 phút. Nó cần quét dữ
     *    liệu nhiều tháng; chậm 10 phút thì không ai nhận ra, mà kéo về ở mỗi tin
     *    nhắn thì đúng vào cái bẫy hiệu năng đã gỡ ở sumPaid().
     */
    private function cafeContext(Cafe $cafe): string
    {
        [$serving, $empty, $tableCount] = $this->tableOccupancy($cafe);
        $todayRevenue = $this->sumPaid($cafe, Carbon::today(), Carbon::tomorrow());

        return "Bạn là trợ lý AI cho quán cà phê \"{$cafe->name}\". "
            . "Trả lời ngắn gọn, thân thiện bằng tiếng Việt. Tiền tệ là VND.\n"
            . "Chỉ dựa trên số liệu dưới đây, KHÔNG bịa thêm số.\n\n"
            . "Tình hình ngay lúc này:\n"
            . "- Tổng số bàn: {$tableCount}\n"
            . "- Đang phục vụ: {$serving} bàn\n"
            . "- Còn trống: {$empty} bàn\n"
            . "- Doanh thu hôm nay: " . number_format($todayRevenue, 0, ',', '.') . "đ\n\n"
            . $this->cachedSalesContext($cafe);
    }

    /**
     * Số bàn đang phục vụ / còn trống, đếm từ ĐƠN ĐANG MỞ.
     *
     * KHÔNG đếm theo `tables.status`: trường đó chỉ là bộ nhớ đệm và có thể lệch vì
     * MongoDB chạy standalone nên không có transaction thật (xem doc/ERD.md mục 2.7).
     * Màn hình Bán hàng cũng dẫn xuất theo cách này (`tablesLive`) — hai nơi phải
     * đếm cùng một kiểu, nếu không AI sẽ nói một đằng còn lưới bàn hiện một nẻo.
     *
     * @return array{0:int,1:int,2:int} [đang phục vụ, còn trống, tổng số bàn]
     */
    private function tableOccupancy(Cafe $cafe): array
    {
        $tableCount = $cafe->tables()->count();

        $serving = Order::where('cafe_id', $cafe->id)
            ->where('status', 'active')
            ->get(['table_id'])
            ->pluck('table_id')
            ->filter()
            ->map(fn ($id) => (string) $id)
            ->unique()
            ->count();

        // Kẹp lại: đơn có thể trỏ tới bàn đã bị xóa, khi đó serving > tableCount.
        $serving = min($serving, $tableCount);

        return [$serving, $tableCount - $serving, $tableCount];
    }

    /**
     * Thực đơn + tình hình bán hàng, nhớ tạm 10 phút theo quán.
     *
     * Dùng lại buildRevenueStats() vốn viết cho trang phân tích doanh thu — nhờ vậy
     * trợ lý trả lời được "món nào bán chạy / ế", "tháng này so tháng trước", những
     * câu mà trước đây nó hoàn toàn không có dữ liệu để trả lời.
     */
    private function cachedSalesContext(Cafe $cafe): string
    {
        return Cache::remember("ai_cafe_sales_ctx_{$cafe->id}", now()->addMinutes(10), function () use ($cafe) {
            $items = $cafe->items()->get(['name', 'base_price', 'is_available']);
            $menu = $items->map(function ($it) {
                $price = number_format((float) ($it->base_price ?? 0), 0, ',', '.');
                $status = ($it->is_available ?? true) ? '' : ' (đang ẩn)';
                return "- {$it->name}: {$price}đ{$status}";
            })->implode("\n");

            $stats = $this->buildRevenueStats($cafe);

            $topItems = collect($stats['top_items'])->take(5)->map(function ($row, $i) {
                $revenue = number_format((float) $row['revenue'], 0, ',', '.');
                return sprintf('%d. %s — bán %d, doanh thu %sđ', $i + 1, $row['name'], $row['count'], $revenue);
            })->implode("\n");

            $thisMonth = number_format((float) $stats['this_month'], 0, ',', '.');
            $lastMonth = number_format((float) $stats['last_month'], 0, ',', '.');

            $out = "Tình hình bán hàng:\n"
                . "- Doanh thu tháng này: {$thisMonth}đ\n"
                . "- Doanh thu tháng trước: {$lastMonth}đ\n"
                . "- Tổng số hóa đơn từ trước tới nay: {$stats['invoice_count']}\n";

            if ($topItems !== '') {
                $out .= "- Món bán chạy nhất:\n{$topItems}\n";
            }

            return $out . "\nThực đơn (" . $items->count() . " món):\n{$menu}";
        });
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
        //
        // Phép cộng nằm ở RevenueStats, dùng chung với trang Doanh thu. Trước đây mỗi
        // nơi có một bản chép tay, và chỉ cần sửa cách tính ở một bên là hai màn hình
        // cùng nói về một quán mà ra hai con số.
        $since = Carbon::now()->subMonths(12)->startOfMonth();
        $so = $this->revenueStats->forCafes([(string) $cafe->id], $since->format('Y-m-d'));

        $byMonth = $so['by_month'];
        $byDay = $so['by_day'];

        // So sánh tháng này vs tháng trước
        $thisMonth = Carbon::now()->format('Y-m');
        $lastMonth = Carbon::now()->subMonth()->format('Y-m');

        return [
            'total_revenue'   => $total,
            'invoice_count'   => $invoiceCount,
            'revenue_by_month'=> array_slice($byMonth, -6, 6, true),
            'revenue_by_day'  => array_slice($byDay, -30, 30, true),
            'top_items'       => $so['top_items'],
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

}
