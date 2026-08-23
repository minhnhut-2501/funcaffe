<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ChecksShopAccess;
use App\Models\Order;
use App\Models\Shop;
use App\Services\VnpayService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Thu tiền BÁN HÀNG qua cổng VNPay — khách quét mã QR bằng điện thoại của họ.
 *
 * Tách khỏi OrderController vì đây là một câu chuyện khác hẳn: OrderController lo
 * vòng đời đơn (mở, thêm món, chốt, hủy), còn chỗ này chỉ lo bắc cầu sang cổng.
 *
 * ĐỪNG LẪN VỚI LUỒNG MUA GÓI. PaymentGatewayController xử lý việc CHỦ QUÁN trả tiền
 * cho FunCafe (bảng `package_payments`). Còn đây là việc KHÁCH trả tiền cho chủ quán
 * (bảng `orders`). Hai luồng dùng chung `VnpayService` để ký, nhưng đi đường riêng
 * hoàn toàn — tuyến, mã tham chiếu, nơi ghi kết quả đều khác. Luồng mua gói đã chạy
 * ổn định qua nhiều lượt thật; gộp vào là đem thứ đang tốt ra đánh cược.
 */
class OrderPaymentController extends Controller
{
    use ChecksShopAccess;

    public function __construct(private VnpayService $vnpay)
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * Dựng liên kết thanh toán VNPay cho một đơn đang phục vụ.
     *
     * Trả về `pay_url` để màn hình Bán hàng vẽ thành mã QR. Khách quét bằng điện
     * thoại, trả tiền trên máy của họ; VNPay gọi ngược về IPN và đơn tự chốt.
     */
    public function taoLienKetVnpay(Request $request, Shop $shop, Order $order)
    {
        $this->authorizeShop($shop);

        if ((string) $order->shop_id !== (string) $shop->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if ($order->status !== 'active') {
            $ly = $order->status === 'paid'
                ? 'Đơn này đã được thanh toán.'
                : 'Đơn đã hủy, không thể thanh toán.';
            return response()->json(['message' => $ly], 400);
        }

        if ($order->orderDetails()->count() === 0) {
            return response()->json(['message' => 'Đơn chưa có món nào, không thể thanh toán.'], 422);
        }

        $soTien = (int) round(max(0, (int) $order->subtotal - (int) ($order->discount_amount ?? 0)));
        if ($soTien <= 0) {
            return response()->json(['message' => 'Số tiền phải lớn hơn 0.'], 422);
        }

        /*
         * Mã tham chiếu SINH MỚI MỖI LẦN bấm, không tái dùng mã cũ của cùng đơn.
         *
         * Khách quét mã rồi bỏ ngang là chuyện thường; thu ngân bấm lại để lấy mã
         * khác. Nếu dùng lại đúng `vnp_TxnRef` cũ thì VNPay coi là giao dịch trùng và
         * từ chối. Đuôi ngẫu nhiên cũng chống được việc mã đơn của hai máy chủ khác
         * nhau (máy local và bản triển khai) đụng nhau trên cùng một tài khoản thử
         * nghiệm — đúng cái bẫy đã vấp với MoMo, xem PackagePayment::gateway_order_id.
         *
         * Chỉ mã MỚI NHẤT có hiệu lực: IPN tra theo `gateway_txn_ref` đang lưu trên
         * đơn, nên tiền của một mã đã bị thay sẽ không chốt nhầm đơn.
         */
        $txnRef = 'OD' . now()->format('ymdHis') . strtoupper(Str::random(6));

        $order->update([
            'gateway_txn_ref' => $txnRef,
            'payment_method'  => 'vnpay',
            'payment_status'  => 'pending',
        ]);

        $payUrl = $this->vnpay->buildPaymentUrl(
            $txnRef,
            $soTien,
            'Thanh toan don ' . $order->code,
            (string) $request->ip(),
            rtrim((string) config('app.url'), '/') . '/api/payments/vnpay/order/return',
        );

        return response()->json([
            'pay_url'  => $payUrl,
            'txn_ref'  => $txnRef,
            'amount'   => $soTien,
            'order_id' => (string) $order->id,
        ]);
    }
}
