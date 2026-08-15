<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use App\Models\Order;
use App\Models\Subscription;
use App\Services\RevenueStats;
use Carbon\Carbon;
use Illuminate\Http\Request;
use MongoDB\BSON\UTCDateTime;
use Throwable;

/**
 * Tổng doanh thu GỘP tất cả quán của một user (đa quán).
 * Khác Admin\RevenueController (toàn hệ thống) — đây chỉ tính các quán do chính
 * user sở hữu. Xem doanh thu là quyền cơ bản của mọi user nên KHÔNG gate theo gói.
 */
class UserRevenueController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function overview(Request $request)
    {
        $user = $request->user();

        $cafes = Cafe::where('user_id', (string) $user->id)->get();
        if ($cafes->isEmpty()) {
            return response()->json([
                'total' => 0,
                'today' => 0,
                'this_month' => 0,
                'count' => 0,
                'revenue_by_month' => [],
                'cafes' => [],
            ]);
        }

        $cafeIds = $cafes->pluck('id')->map(fn ($id) => (string) $id)->all();

        // Gói active (còn hiệu lực) của từng quán -> hiện tên gói trên thẻ.
        $activeSubs = Subscription::whereIn('cafe_id', $cafeIds)
            ->effective()
            ->get()
            ->keyBy(fn ($s) => (string) $s->cafe_id);

        // Doanh thu đọc thẳng từ order đã thanh toán (bỏ bảng invoices).
        //
        // Chỉ lấy BỐN trường cần cho phép cộng. Trước đây `->get()` kéo về nguyên
        // document: chủ ba quán chạy hai năm là vài chục nghìn tài liệu đầy đủ nằm
        // trong RAM của PHP cho mỗi lần mở Bảng điều khiển, trong khi tất cả những gì
        // dùng tới chỉ là số tiền và ngày.
        $invoices = Order::whereIn('cafe_id', $cafeIds)
            ->where('status', 'paid')
            ->where('payment_status', 'paid')
            ->get(['cafe_id', 'total_amount', 'paid_at', 'created_at']);

        $todayStr = Carbon::now()->format('Y-m-d');
        $thisMonthStr = Carbon::now()->format('Y-m');

        $byMonth = [];                 // gộp mọi quán, key 'Y-m'
        $perCafe = [];                 // key cafe_id => ['total','today','month','count']
        foreach ($cafeIds as $cid) {
            $perCafe[$cid] = ['total' => 0, 'today' => 0, 'month' => 0, 'count' => 0];
        }

        $grandTotal = 0;
        $grandToday = 0;
        $grandMonth = 0;
        $grandCount = 0;

        foreach ($invoices as $inv) {
            $cid = (string) $inv->cafe_id;
            $amount = (int) ($inv->total_amount ?? 0);
            $date = $this->toCarbon($inv->paid_at ?? $inv->created_at);

            $grandTotal += $amount;
            $grandCount += 1;
            if (isset($perCafe[$cid])) {
                $perCafe[$cid]['total'] += $amount;
                // SỐ hóa đơn, không chỉ số tiền. Trang Quản lý quán hiện "N hóa đơn"
                // cạnh mỗi quán; thiếu số này thì trang buộc phải tự tải về toàn bộ
                // hóa đơn chỉ để đếm — đúng lượt gọi nặng mà endpoint này sinh ra để
                // thay thế.
                $perCafe[$cid]['count'] += 1;
            }

            if ($date) {
                $mKey = $date->format('Y-m');
                $byMonth[$mKey] = ($byMonth[$mKey] ?? 0) + $amount;

                if ($date->format('Y-m-d') === $todayStr) {
                    $grandToday += $amount;
                    if (isset($perCafe[$cid])) {
                        $perCafe[$cid]['today'] += $amount;
                    }
                }
                if ($mKey === $thisMonthStr) {
                    $grandMonth += $amount;
                    if (isset($perCafe[$cid])) {
                        $perCafe[$cid]['month'] += $amount;
                    }
                }
            }
        }

        ksort($byMonth);

        $cafeRows = $cafes->map(function ($cafe) use ($perCafe, $activeSubs) {
            $cid = (string) $cafe->id;
            $sub = $activeSubs->get($cid);
            $stat = $perCafe[$cid] ?? ['total' => 0, 'today' => 0, 'month' => 0, 'count' => 0];

            return [
                'cafe_id' => $cid,
                'cafe_name' => $cafe->name,
                'status' => $cafe->status,
                'package_name' => $sub->package_name_snapshot ?? null,
                'has_package' => $sub !== null,
                'total' => $stat['total'],
                'today' => $stat['today'],
                'month' => $stat['month'],
                'count' => $stat['count'],
            ];
        })->values();

        return response()->json([
            'total' => $grandTotal,
            'today' => $grandToday,
            'this_month' => $grandMonth,
            'count' => $grandCount,
            'revenue_by_month' => array_slice($byMonth, -12, 12, true),
            'cafes' => $cafeRows,
        ]);
    }

    /**
     * Số liệu cho TRANG DOANH THU: tổng, theo ngày, theo tháng, top món, tách quán —
     * tất cả trong một lượt gọi, đã cộng sẵn ở máy chủ.
     *
     * Khác `overview()` ở trên: overview là bức ảnh cố định (toàn thời gian, hôm nay,
     * tháng này) cho thẻ tóm tắt và tên gói; còn đây nhận khoảng ngày và phạm vi quán
     * do người dùng chọn, và trả thêm phần dựng biểu đồ.
     *
     * Thay cho việc trình duyệt tải toàn bộ hóa đơn của từng quán rồi tự cộng: cùng
     * một kết quả, nhưng vài chục kilobyte thay vì vài megabyte, và một request thay
     * vì một request cho mỗi quán.
     *
     * KHÔNG trả về từng hóa đơn. Nút Xuất Excel cần chi tiết thì đi lấy riêng lúc bấm
     * — đó là thao tác hiếm, không đáng bắt mọi lượt mở trang trả giá.
     */
    public function summary(Request $request, RevenueStats $stats)
    {
        $user = $request->user();

        $validated = $request->validate([
            'from'    => 'nullable|date_format:Y-m-d',
            'to'      => 'nullable|date_format:Y-m-d',
            // Vắng mặt = gộp mọi quán của chủ tài khoản.
            'cafe_id' => 'nullable|string',
        ]);

        $cafes = Cafe::where('user_id', (string) $user->id)->get();

        if (!empty($validated['cafe_id'])) {
            $chon = $cafes->first(fn ($c) => (string) $c->id === $validated['cafe_id']);
            // Quán không thuộc tài khoản này thì báo không tìm thấy, đừng lặng lẽ trả
            // về toàn số 0 — người đọc sẽ tưởng quán mình chưa bán được gì.
            if (!$chon) {
                return response()->json(['message' => 'Không tìm thấy quán.'], 404);
            }
            $cafes = collect([$chon]);
        }

        $tenQuan = $cafes->mapWithKeys(fn ($c) => [(string) $c->id => $c->name]);

        $so = $stats->forCafes(
            $tenQuan->keys()->all(),
            $validated['from'] ?? null,
            $validated['to'] ?? null,
        );

        return response()->json([
            'total'     => $so['total'],
            'count'     => $so['count'],
            'by_day'    => (object) $so['by_day'],
            'by_month'  => (object) $so['by_month'],
            'top_items' => $so['top_items'],
            'cafes'     => collect($so['by_cafe'])->map(fn ($row, $cid) => [
                'cafe_id'   => $cid,
                'cafe_name' => $tenQuan[$cid] ?? '',
                'total'     => $row['total'],
                'count'     => $row['count'],
            ])->values(),
        ]);
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
