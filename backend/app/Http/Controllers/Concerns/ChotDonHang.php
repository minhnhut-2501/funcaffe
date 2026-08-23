<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Order;
use App\Models\Shop;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Chốt một đơn thành ĐÃ THANH TOÁN.
 *
 * Nằm ở trait vì có BA đường dẫn tới cùng một việc, và chúng phải làm y hệt nhau:
 *   1. OrderController@pay        — thu tiền tại bàn
 *   2. OrderController@store      — bán mang về, tạo và chốt một lượt
 *   3. PaymentGatewayController   — cổng VNPay báo khách đã trả (tuyến CÔNG KHAI,
 *                                   không đi qua auth nên không dùng chung
 *                                   controller được)
 *
 * Ba đường đó phải sinh mã phiếu, ghi có điều kiện và trả bàn giống nhau. Chép ba
 * bản là chắc chắn có ngày một bản quên một bước.
 */
trait ChotDonHang
{
    /**
     * Kiểm tiền khách đưa và tính tiền thối. Ném 422 nếu đưa thiếu.
     *
     * `cash_received` BẮT BUỘC khi trả tiền mặt — nhưng luật đó KHÔNG đặt được ở
     * `validate()` của store(), vì ở đó `payment_method` là tuỳ chọn (chỉ đơn mang về
     * mới gửi). Gom vào một chỗ để pay() và store() không thể lệch nhau.
     *
     * Trước đây `cash_received` là `nullable` và cái chốt "đưa thiếu thì không cho
     * thanh toán" lại nằm TRONG một điều kiện `isset()`. Nghĩa là bỏ trống ô tiền
     * khách đưa là thoát được chốt: đơn chốt bình thường, `cash_received` và
     * `change_amount` cùng null, biên lai in ra không có tiền thối để đối chiếu.
     * Ràng buộc chỉ sống ở trình duyệt thì không phải ràng buộc.
     *
     * @return array{cash_received: ?int, change_amount: ?int}
     */
    private function kiemTienKhachDua(string $phuongThuc, $cashReceived, int $total): array
    {
        if ($phuongThuc !== 'cash') {
            return ['cash_received' => null, 'change_amount' => null];
        }

        if ($cashReceived === null || $cashReceived === '') {
            throw new HttpResponseException(response()->json([
                'message' => 'Trả tiền mặt thì phải ghi số tiền khách đưa.',
                'errors'  => ['cash_received' => ['Trả tiền mặt thì phải ghi số tiền khách đưa.']],
            ], 422));
        }

        $daDua = (int) round((float) $cashReceived);
        if ($daDua < $total) {
            throw new HttpResponseException(response()->json([
                'message' => 'Tiền khách đưa chưa đủ. Cần tối thiểu ' . number_format($total, 0, ',', '.') . 'đ.',
            ], 422));
        }

        return ['cash_received' => $daDua, 'change_amount' => max(0, $daDua - $total)];
    }

    /**
     * Chốt một đơn thành ĐÃ THANH TOÁN: sinh mã phiếu, ghi có điều kiện, trả bàn.
     *
     * Dùng chung cho ba đường: pay() (tại quán), store() (mang về trả ngay), và
     * callback của cổng thanh toán. Ba đường đó phải sinh mã phiếu và chốt đơn y hệt
     * nhau — tách ra đây để không có đường nào lỡ quên một bước.
     *
     * Trả về mã phiếu, hoặc NULL khi đơn đã bị request khác chốt trước.
     *
     * @param array{payment_method: string, discount: int, total: int, cash_received: ?int, change_amount: ?int, paid_by: ?string} $tt
     */
    private function chotDon(Shop $shop, Order $order, array $tt): ?string
    {
        $todayStr = now()->format('Ymd');
        // B7: dò tiếp tới số chưa dùng để tránh trùng mã khi request song song.
        // Mã phiếu (invoice_code) nay lưu thẳng trên order — không còn bảng invoices.
        $invoiceCount = $shop->orders()
            ->where('invoice_code', 'like', "INV-{$todayStr}-%")
            ->count() + 1;
        do {
            $invoiceCode = 'INV-' . $todayStr . '-' . str_pad($invoiceCount++, 4, '0', STR_PAD_LEFT);
        } while ($shop->orders()->where('invoice_code', $invoiceCode)->exists());

        // CHỐT ĐƠN BẰNG MỘT PHÉP GHI CÓ ĐIỀU KIỆN (4.6.10).
        //
        // Kiểm `status !== 'active'` ở nơi gọi không đủ: hai request song song (bấm
        // đúp, mở hai tab, mạng chập chờn nên trình duyệt gửi lại) đều đọc thấy
        // 'active' rồi cùng đi tiếp, ra HAI mã phiếu cho một đơn. Mongo standalone
        // không có transaction nên `atomic()` chạy thẳng, không cứu được chỗ này.
        //
        // Cách chắc chắn: đưa điều kiện vào chính câu lệnh ghi. MongoDB cập nhật một
        // tài liệu là thao tác nguyên tử, nên chỉ request nào còn thấy status='active'
        // mới ghi được; request đến sau nhận về 0 dòng đổi và bị từ chối. Mã phiếu mà
        // nó lỡ sinh ra chưa ghi vào đâu cả nên tự tan.
        $daChot = Order::where('_id', $order->id)
            ->where('status', 'active')
            ->update([
                'status'          => 'paid',
                'invoice_code'    => $invoiceCode,
                'payment_method'  => $tt['payment_method'],
                'payment_status'  => 'paid',
                'paid_at'         => now(),
                'discount_amount' => $tt['discount'],
                'total_amount'    => $tt['total'],
                'cash_received'   => $tt['cash_received'],
                'change_amount'   => $tt['change_amount'],
                'paid_by'         => $tt['paid_by'],
            ]);

        if ($daChot === 0) {
            return null;
        }

        // Thanh toán xong -> bàn về TRỐNG luôn (bỏ trạng thái 'cleaning').
        // Đơn mang về không gắn bàn nào nên bỏ qua bước này.
        if ($order->table_id) {
            $shop->tables()->where('_id', $order->table_id)->update([
                'status'           => 'empty',
                'current_order_id' => null,
            ]);
        }

        return $invoiceCode;
    }
}
