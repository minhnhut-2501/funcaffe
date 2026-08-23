<?php

namespace App\Services;

use App\Models\Order;
use Carbon\Carbon;
use MongoDB\BSON\UTCDateTime;
use Throwable;

/**
 * Phép cộng doanh thu, làm MỘT LẦN ở máy chủ.
 *
 * Vì sao tồn tại: cùng một phép cộng này trước đây có ba bản. Trợ lý AI cộng ở
 * `AiController::buildRevenueStats`, trang Doanh thu và trang Quản lý quán thì tải
 * TOÀN BỘ hóa đơn kèm dòng món và topping về trình duyệt rồi cộng bằng JavaScript.
 * Bản thứ ba là bản đắt nhất: gần 2.000 hóa đơn của ba quán demo là vài megabyte
 * qua đường truyền, trong khi thứ hiện lên màn hình chỉ là vài chục con số.
 *
 * Chi phí sau khi gom về đây tỉ lệ với SỐ CỘT trên biểu đồ chứ không còn tỉ lệ với
 * số hóa đơn — nghĩa là nó không lớn thêm theo tháng sử dụng nữa.
 *
 * Ngày giờ: mọi phép cắt ngày/tháng ở đây theo GIỜ ĐỊA PHƯƠNG (`config('app.timezone')`
 * = Asia/Ho_Chi_Minh), khớp với `ngayDiaPhuong()` bên trình duyệt. Cắt theo UTC thì
 * đơn thu từ 00:00–07:00 rơi sang hôm trước. `RevenueTimezoneTest` giữ chốt này.
 */
class RevenueStats
{
    /** Số món bán chạy trả về khi nơi gọi không nói rõ. */
    public const TOP_ITEMS = 8;

    /**
     * Gộp doanh thu của một hoặc nhiều quán trong một khoảng ngày.
     *
     * @param  string[]     $shopIds  Danh sách quán. Rỗng thì trả về bộ số 0.
     * @param  string|null  $from     'Y-m-d' giờ địa phương, tính từ 00:00:00.
     * @param  string|null  $to       'Y-m-d' giờ địa phương, tính hết 23:59:59.
     * @param  int          $topItems 0 = bỏ qua top món, không nạp dòng món (rẻ hơn hẳn).
     *
     * @return array{
     *   total:int, count:int,
     *   by_day:array<string,int>, by_month:array<string,int>,
     *   top_items:list<array{name:string,count:int,revenue:int}>,
     *   by_shop:array<string,array{total:int,count:int}>
     * }
     */
    public function forShops(array $shopIds, ?string $from = null, ?string $to = null, int $topItems = self::TOP_ITEMS): array
    {
        $shopIds = array_values(array_unique(array_map('strval', $shopIds)));

        // Mọi quán đều có mặt trong `by_shop`, kể cả quán không bán được gì. Thiếu
        // hàng thì bảng so sánh bên trình duyệt phải tự đoán quán nào bị rớt, và
        // "chưa có doanh thu" trông y hệt "tải hỏng".
        $perShop = [];
        foreach ($shopIds as $cid) {
            $perShop[$cid] = ['total' => 0, 'count' => 0];
        }

        // Hai hình thức bán LUÔN có mặt, kể cả khi chưa bán được cái nào. Thiếu khóa
        // thì thẻ "Mang về" bên trình duyệt hiện trống thay vì hiện 0 — hai chuyện khác hẳn.
        $theoHinhThuc = [
            'dine_in'  => ['total' => 0, 'count' => 0],
            'takeaway' => ['total' => 0, 'count' => 0],
        ];

        if ($shopIds === []) {
            return [
                'total' => 0, 'count' => 0,
                'by_day' => [], 'by_month' => [], 'top_items' => [], 'by_shop' => [],
                'by_order_type' => $theoHinhThuc,
            ];
        }

        $query = Order::whereIn('shop_id', $shopIds)
            ->where('status', 'paid')
            ->where('payment_status', 'paid');

        $this->apDungKhoang($query, $from, $to);

        // Chỉ bốn trường cần cho phép cộng, cộng `_id` để quan hệ dòng món còn nối
        // được. Nạp nguyên document là kéo theo ghi chú, tiền khách đưa, tiền thối —
        // những thứ không góp gì vào một con số tổng.
        if ($topItems > 0) {
            $query->with('orderDetails');
        }
        $orders = $query->get(['_id', 'shop_id', 'total_amount', 'paid_at', 'created_at', 'order_type']);

        $byDay = [];
        $byMonth = [];
        $monMua = [];
        $total = 0;
        $count = 0;

        foreach ($orders as $order) {
            $tien = (int) ($order->total_amount ?? 0);
            $total += $tien;
            $count++;

            $cid = (string) $order->shop_id;
            if (isset($perShop[$cid])) {
                $perShop[$cid]['total'] += $tien;
                $perShop[$cid]['count'] += 1;
            }

            // Đơn CŨ (có trước khi hệ thống bán mang về) không mang trường này — tính
            // là bán tại quán. Đúng với thực tế: lúc đó chưa bán mang về được.
            $hinhThuc = $order->order_type === 'takeaway' ? 'takeaway' : 'dine_in';
            $theoHinhThuc[$hinhThuc]['total'] += $tien;
            $theoHinhThuc[$hinhThuc]['count'] += 1;

            $moc = $this->toCarbon($order->paid_at ?? $order->created_at);
            if ($moc) {
                $ngay = $moc->format('Y-m-d');
                $thang = $moc->format('Y-m');
                $byDay[$ngay] = ($byDay[$ngay] ?? 0) + $tien;
                $byMonth[$thang] = ($byMonth[$thang] ?? 0) + $tien;
            }

            if ($topItems <= 0) {
                continue;
            }

            foreach ($order->orderDetails as $dong) {
                $ten = $dong->product_name_snapshot ?? 'Khác';
                $sl = (int) ($dong->quantity ?? 0);
                // total_price đã gồm topping; đơn cũ chưa có trường đó thì dựng lại
                // từ đơn giá — thiếu phần topping, nhưng đúng hơn là bỏ trắng.
                $doanhThu = (int) ($dong->total_price ?? (($dong->unit_price ?? 0) * $sl));

                if (!isset($monMua[$ten])) {
                    $monMua[$ten] = ['name' => $ten, 'count' => 0, 'revenue' => 0];
                }
                $monMua[$ten]['count'] += $sl;
                $monMua[$ten]['revenue'] += $doanhThu;
            }
        }

        ksort($byDay);
        ksort($byMonth);
        $monMua = array_values($monMua);
        usort($monMua, fn ($a, $b) => $b['revenue'] <=> $a['revenue']);

        return [
            'total' => $total,
            'count' => $count,
            'by_day' => $byDay,
            'by_month' => $byMonth,
            'top_items' => array_slice($monMua, 0, max(0, $topItems)),
            'by_shop' => $perShop,
            'by_order_type' => $theoHinhThuc,
        ];
    }

    /**
     * Giới hạn theo khoảng ngày, có đường lui cho đơn CŨ thiếu `paid_at`.
     *
     * Đơn thiếu `paid_at` mà chỉ lọc trên trường đó thì biến mất khỏi mọi khoảng —
     * doanh thu tụt đi một cách im lặng. Nhánh `orWhere` kéo chúng về theo ngày tạo,
     * đúng như nơi khác trong ứng dụng vẫn làm.
     */
    private function apDungKhoang($query, ?string $from, ?string $to): void
    {
        if ($from) {
            $moc = Carbon::parse($from)->startOfDay();
            $query->where(function ($q) use ($moc) {
                $q->where('paid_at', '>=', $moc)
                  ->orWhere(fn ($q2) => $q2->whereNull('paid_at')->where('created_at', '>=', $moc));
            });
        }

        if ($to) {
            $moc = Carbon::parse($to)->endOfDay();
            $query->where(function ($q) use ($moc) {
                $q->where('paid_at', '<=', $moc)
                  ->orWhere(fn ($q2) => $q2->whereNull('paid_at')->where('created_at', '<=', $moc));
            });
        }
    }

    /**
     * Mốc thời gian của Mongo về Carbon theo giờ ĐỊA PHƯƠNG.
     *
     * `UTCDateTime::toDateTime()` trả về đối tượng mang múi giờ UTC, nên phải đổi
     * tường minh — nếu không thì `format('Y-m-d')` cắt theo UTC. Thư viện hiện tại đã
     * tự đổi khi đọc thuộc tính (nhánh `instanceof Carbon` bên dưới bắt được hầu hết
     * trường hợp), nhưng nhánh UTCDateTime vẫn phải đúng: nó là đường đi khi ai đó
     * truy vấn thô, và một bản nâng cấp thư viện có thể trả lại kiểu này bất cứ lúc nào.
     */
    private function toCarbon($date): ?Carbon
    {
        if (!$date) {
            return null;
        }
        if ($date instanceof Carbon) {
            return $date->copy()->setTimezone(config('app.timezone'));
        }
        if ($date instanceof UTCDateTime) {
            return Carbon::instance($date->toDateTime())->setTimezone(config('app.timezone'));
        }
        try {
            return Carbon::parse((string) $date)->setTimezone(config('app.timezone'));
        } catch (Throwable) {
            return null;
        }
    }
}
