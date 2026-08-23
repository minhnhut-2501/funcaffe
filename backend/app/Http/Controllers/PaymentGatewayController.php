<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RunsAtomically;
use App\Http\Controllers\Concerns\ChotDonHang;
use App\Models\Order;
use App\Models\PackagePayment;
use App\Models\Shop;
use App\Services\MomoService;
use App\Services\SubscriptionActivator;
use App\Services\VnpayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Xử lý callback từ các cổng thanh toán (luồng chủ quán trả tiền gói): VNPay và MoMo.
 * Các endpoint này PUBLIC (cổng/trình duyệt gọi không kèm token).
 */
class PaymentGatewayController extends Controller
{
    use RunsAtomically;
    use ChotDonHang;

    public function __construct(
        private VnpayService $vnpay,
        private MomoService $momo,
        private SubscriptionActivator $activator,
    ) {}

    /** Đường dẫn trang kết quả ở frontend, dùng chung cho mọi cổng. */
    private function resultBase(): string
    {
        // config() chứ không env(): Dockerfile chạy `artisan config:cache` lúc khởi động,
        // và khi config đã cache thì Laravel không nạp file .env nữa.
        $frontend = rtrim((string) config('app.frontend_url', 'http://localhost:3000'), '/');
        return $frontend . '/user/subscription/payment-result';
    }

    /**
     * Giao dịch đã ở trạng thái "tiền đã vào và gói đã được cấp" hay chưa?
     *
     * markPaidAndActivate() trả false ở HAI tình huống rất khác nhau:
     *  - Đơn đã 'paid' từ trước (Return URL và IPN cùng về — chuyện bình thường,
     *    gói vẫn đang chạy, phải báo THÀNH CÔNG).
     *  - Đơn ở trạng thái không kích hoạt được ('rejected') — đây mới là sự cố.
     * Chỉ nhìn giá trị trả về thì không phân biệt được, nên đọc lại trạng thái thật.
     */
    private function isSettled(PackagePayment $payment, bool $activated): bool
    {
        return $activated || $payment->fresh()?->payment_status === 'paid';
    }

    /**
     * Cổng báo đã thu tiền nhưng hệ thống không cấp được gói.
     *
     * Đây là tình huống KHÁCH ĐÃ MẤT TIỀN, nên phải để lại dấu vết cho con người
     * xử lý: ghi log ở mức error kèm đủ thông tin đối soát với sao kê của cổng.
     */
    private function reportUnactivated(PackagePayment $payment, string $gateway): void
    {
        Log::error('[thanh-toan] Cổng báo thu tiền thành công nhưng không kích hoạt được gói', [
            'gateway'          => $gateway,
            'payment_id'       => (string) $payment->id,
            'transaction_code' => $payment->transaction_code,
            'gateway_txn_no'   => $payment->gateway_txn_no,
            'payment_status'   => $payment->fresh()?->payment_status,
            'shop_id'          => (string) $payment->shop_id,
            'amount'           => $payment->amount,
        ]);
    }

    /**
     * Tìm đơn theo mã MoMo trả về. Mã gửi sang MoMo có đuôi ngẫu nhiên nên nằm ở
     * gateway_order_id chứ không phải transaction_code — xem chú thích trong
     * PackagePayment. Vẫn dò tiếp theo transaction_code để các đơn tạo TRƯỚC khi
     * có trường này (chưa có đuôi) không thành mồ côi.
     */
    private function findMomoPayment(?string $orderId): ?PackagePayment
    {
        if (!$orderId) {
            return null;
        }

        return PackagePayment::where('gateway_order_id', $orderId)->first()
            ?? PackagePayment::where('transaction_code', $orderId)->first();
    }

    /**
     * Return URL: trình duyệt người dùng được VNPay chuyển hướng về đây sau khi trả tiền.
     * Backend xác thực chữ ký, kích hoạt gói, rồi redirect về trang kết quả của frontend.
     *
     * Ghi chú: trên localhost IPN của VNPay không gọi tới được nên việc kích hoạt
     * được thực hiện ngay tại Return URL (idempotent nên không lo trùng với IPN).
     */
    public function vnpayReturn(Request $request)
    {
        $query = $request->query();
        $resultBase = $this->resultBase() . '?gateway=vnpay';

        $code = $query['vnp_ResponseCode'] ?? null;

        if (!$this->vnpay->validateSignature($query)) {
            return redirect()->away($resultBase . '&status=fail&code=invalid_signature');
        }

        $payment = PackagePayment::where('transaction_code', $query['vnp_TxnRef'] ?? '')->first();
        if (!$payment) {
            return redirect()->away($resultBase . '&status=fail&code=not_found');
        }

        if ($code === '00') {
            $activated = $this->atomic(function () use ($payment, $query) {
                $payment->update([
                    'gateway_txn_no'   => $query['vnp_TransactionNo'] ?? null,
                    'gateway_bank_code' => $query['vnp_BankCode'] ?? null,
                ]);
                return $this->activator->markPaidAndActivate($payment);
            });

            if (!$this->isSettled($payment, $activated)) {
                $this->reportUnactivated($payment, 'vnpay');
                return redirect()->away($resultBase . '&status=fail&code=not_activated');
            }

            return redirect()->away($resultBase . '&status=success&code=00');
        }

        // Người dùng hủy (code 24) hoặc thanh toán thất bại: từ chối giao dịch và
        // rollback subscription để nó KHÔNG lọt vào hàng chờ duyệt của admin.
        $this->atomic(function () use ($payment) {
            $this->activator->rejectAndRollback($payment);
        });

        return redirect()->away($resultBase . '&status=fail&code=' . urlencode((string) $code));
    }

    /**
     * IPN URL (server-to-server). Dùng khi deploy public. Trả JSON theo chuẩn VNPay.
     */
    public function vnpayIpn(Request $request)
    {
        $query = $request->query();

        /*
         * PHÂN LUỒNG NGAY Ở CỬA: VNPay chỉ gọi MỘT địa chỉ IPN duy nhất.
         *
         * Địa chỉ đó khai một lần trong cổng thương nhân, không gửi kèm từng giao dịch
         * như `vnp_ReturnUrl`. Nghĩa là tuyến `payments/vnpay/order/ipn` mà mã nguồn có
         * sẵn sẽ KHÔNG BAO GIỜ được VNPay gọi tới — mọi callback đều đổ vào đây.
         *
         * Đã trả giá để biết điều này: đơn bán hàng đầu tiên thanh toán thật trên bản
         * deploy trả tiền xong mà vẫn nằm ở 'active/pending', vì callback rơi vào hàm
         * này rồi không tìm thấy `package_payments` nào khớp mã.
         *
         * Hai luồng phân biệt được bằng tiền tố mã tham chiếu, không cần đoán:
         *   - mua gói   : TXN-<ngày>-0001   (SubscriptionController)
         *   - bán hàng  : OD<ymdHis><6 ký tự> (OrderPaymentController)
         *
         * Tuyến `/order/ipn` vẫn giữ: nó là nơi logic thật nằm, và gọi thẳng được khi
         * cần thử tay hoặc khi VNPay cho khai nhiều địa chỉ về sau.
         */
        if (str_starts_with((string) ($query['vnp_TxnRef'] ?? ''), 'OD')) {
            return $this->vnpayOrderIpn($request);
        }

        if (!$this->vnpay->validateSignature($query)) {
            return response()->json(['RspCode' => '97', 'Message' => 'Invalid signature']);
        }

        $payment = PackagePayment::where('transaction_code', $query['vnp_TxnRef'] ?? '')->first();
        if (!$payment) {
            return response()->json(['RspCode' => '01', 'Message' => 'Order not found']);
        }

        // Kiểm tra số tiền khớp (VNPay gửi vnp_Amount đã x100)
        $expected = (int) round((float) $payment->amount) * 100;
        if ((int) ($query['vnp_Amount'] ?? -1) !== $expected) {
            return response()->json(['RspCode' => '04', 'Message' => 'Invalid amount']);
        }

        if ($payment->payment_status === 'paid') {
            return response()->json(['RspCode' => '02', 'Message' => 'Order already confirmed']);
        }

        if (($query['vnp_ResponseCode'] ?? null) === '00') {
            $activated = $this->atomic(function () use ($payment, $query) {
                $payment->update([
                    'gateway_txn_no'    => $query['vnp_TransactionNo'] ?? null,
                    'gateway_bank_code' => $query['vnp_BankCode'] ?? null,
                ]);
                return $this->activator->markPaidAndActivate($payment);
            });

            if (!$this->isSettled($payment, $activated)) {
                $this->reportUnactivated($payment, 'vnpay-ipn');
                // Mã 99 = lỗi phía merchant. Báo đúng để VNPay còn gửi lại IPN,
                // thay vì nói "Confirm Success" trong khi gói chưa được cấp.
                return response()->json(['RspCode' => '99', 'Message' => 'Activation failed']);
            }

            return response()->json(['RspCode' => '00', 'Message' => 'Confirm Success']);
        }

        $this->atomic(function () use ($payment) {
            $this->activator->rejectAndRollback($payment);
        });
        return response()->json(['RspCode' => '00', 'Message' => 'Confirm Success']);
    }

    /**
     * Return URL của MoMo: trình duyệt được chuyển hướng về đây sau khi trả tiền.
     *
     * Giống vnpayReturn về cấu trúc, nhưng khác ba chỗ: mã thành công là
     * resultCode === 0 (số, không phải chuỗi '00'), số tiền KHÔNG nhân 100, và
     * MoMo không có mã ngân hàng nên gateway_bank_code để trống.
     */
    public function momoReturn(Request $request)
    {
        $data = $request->query();
        $resultBase = $this->resultBase() . '?gateway=momo';

        if (!$this->momo->validateSignature($data)) {
            return redirect()->away($resultBase . '&status=fail&code=invalid_signature');
        }

        $payment = $this->findMomoPayment($data['orderId'] ?? null);
        if (!$payment) {
            return redirect()->away($resultBase . '&status=fail&code=not_found');
        }

        if ((int) ($data['resultCode'] ?? -1) === 0) {
            $activated = $this->atomic(function () use ($payment, $data) {
                $payment->update(['gateway_txn_no' => $data['transId'] ?? null]);
                return $this->activator->markPaidAndActivate($payment);
            });

            if (!$this->isSettled($payment, $activated)) {
                $this->reportUnactivated($payment, 'momo');
                return redirect()->away($resultBase . '&status=fail&code=not_activated');
            }

            return redirect()->away($resultBase . '&status=success&code=0');
        }

        // Người dùng hủy hoặc trả tiền thất bại: từ chối giao dịch và rollback
        // subscription để nó KHÔNG lọt vào hàng chờ duyệt của admin.
        $this->atomic(function () use ($payment) {
            $this->activator->rejectAndRollback($payment);
        });

        return redirect()->away($resultBase . '&status=fail&code=' . urlencode((string) ($data['resultCode'] ?? '')));
    }

    /**
     * IPN của MoMo — POST với thân JSON (VNPay thì GET với tham số trên query).
     * Theo tài liệu, phản hồi mong đợi là HTTP 204 No Content.
     */
    public function momoIpn(Request $request)
    {
        $data = $request->all();

        if (!$this->momo->validateSignature($data)) {
            return response()->noContent();
        }

        $payment = $this->findMomoPayment($data['orderId'] ?? null);
        if (!$payment) {
            return response()->noContent();
        }

        // Số tiền MoMo gửi là VND nguyên giá trị — không có phép nhân 100 như VNPay.
        if ((int) ($data['amount'] ?? -1) !== (int) round((float) $payment->amount)) {
            return response()->noContent();
        }

        // Đã kích hoạt rồi (thường là do Return URL chạy trước) thì không phải làm gì.
        // Đây chỉ là lối tắt: markPaidAndActivate() tự chặn trường hợp 'paid' rồi.
        if ($payment->payment_status === 'paid') {
            return response()->noContent();
        }

        if ((int) ($data['resultCode'] ?? -1) === 0) {
            $activated = $this->atomic(function () use ($payment, $data) {
                $payment->update(['gateway_txn_no' => $data['transId'] ?? null]);
                return $this->activator->markPaidAndActivate($payment);
            });

            if (!$this->isSettled($payment, $activated)) {
                $this->reportUnactivated($payment, 'momo-ipn');
            }
        } else {
            $this->atomic(function () use ($payment) {
                $this->activator->rejectAndRollback($payment);
            });
        }

        return response()->noContent();
    }

    // =========================================================================
    // THU TIỀN BÁN HÀNG (khách trả tiền cho chủ quán) — KHÁC luồng mua gói ở trên.
    //
    // Ở trên là CHỦ QUÁN trả tiền cho FunCafe, ghi vào `package_payments` và kích
    // hoạt gói. Dưới đây là KHÁCH trả tiền cho chủ quán, ghi vào `orders` và chốt
    // hóa đơn. Hai luồng dùng chung `VnpayService` để ký nhưng đi tuyến riêng hoàn
    // toàn — luồng mua gói đã chạy ổn qua nhiều lượt thật, không đụng vào.
    // =========================================================================

    /**
     * Khách quay về sau khi trả tiền trên điện thoại của họ — VÀ CHỐT ĐƠN TẠI ĐÂY.
     *
     * Ban đầu chỗ này cố tình KHÔNG chốt, với lý do "return do trình duyệt khách gọi
     * nên ai cũng gọi được". Vế đó SAI: ai cũng gọi được, nhưng không ai dựng nổi
     * `vnp_SecureHash` hợp lệ nếu không có khóa bí mật. Kiểm chữ ký ở đây chắc chắn
     * y như ở IPN — và luồng MUA GÓI vốn đã chốt theo đúng cách này từ đầu
     * (`vnpayReturn` gọi markPaidAndActivate), đó là lý do nó chạy được.
     *
     * Vì sao phải chốt cả ở đây: IPN chỉ tới nếu địa chỉ của nó được khai trong cổng
     * thương nhân VNPay. Thử thật trên bản deploy ngày 24/08: khách trả tiền sandbox
     * thành công, thấy trang cảm ơn, mà IPN không bao giờ tới — đơn nằm im ở
     * 'active/pending'. Dựa vào MỘT đường là dựa vào một thứ mình không kiểm soát.
     *
     * Hai đường cùng chốt KHÔNG gây chốt hai lần: `chotDon()` ghi có điều kiện
     * `status='active'`, đường tới sau nhận 0 dòng đổi và bỏ qua.
     */
    public function vnpayOrderReturn(Request $request)
    {
        $query = $request->query();
        $ok = $this->vnpay->validateSignature($query) && ($query['vnp_ResponseCode'] ?? null) === '00';

        if ($ok) {
            // Dùng lại đúng hàm của IPN để hai đường không thể xử lý khác nhau.
            $this->vnpayOrderIpn($request);
        }

        $tieuDe = $ok ? 'Thanh toán thành công' : 'Thanh toán chưa hoàn tất';
        $loi    = $ok
            ? 'Cảm ơn bạn. Vui lòng quay lại quầy để nhận đồ và hóa đơn.'
            : 'Giao dịch chưa hoàn tất. Vui lòng báo nhân viên tại quầy.';
        $mau    = $ok ? '#0F7B4F' : '#B4341C';

        // Trang tĩnh, không phụ thuộc frontend: khách đang mở trên điện thoại của họ,
        // đưa họ vào khu vực quản trị của chủ quán là vừa vô nghĩa vừa không nên.
        return response(
            '<!doctype html><html lang="vi"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>' . $tieuDe . '</title></head>'
            . '<body style="font-family:system-ui,-apple-system,sans-serif;display:grid;'
            . 'place-items:center;min-height:100vh;margin:0;background:#FAF7F2;text-align:center;padding:24px">'
            . '<div><h1 style="color:' . $mau . ';font-size:22px;margin:0 0 12px">' . $tieuDe . '</h1>'
            . '<p style="color:#4A4A4A;font-size:15px;line-height:1.6;margin:0">' . $loi . '</p></div>'
            . '</body></html>',
            200,
            ['Content-Type' => 'text/html; charset=UTF-8'],
        );
    }

    /**
     * IPN cho đơn BÁN HÀNG (server-to-server). Đây mới là nơi đơn được chốt.
     *
     * Trả JSON theo đúng chuẩn VNPay: `RspCode` '00' nghĩa là "đã nhận và xử lý xong",
     * mã khác thì VNPay sẽ gọi lại. Nói '00' cho một giao dịch mình chưa ghi nhận được
     * là mất tiền của khách mà không có hóa đơn.
     */
    public function vnpayOrderIpn(Request $request)
    {
        $query = $request->query();

        if (!$this->vnpay->validateSignature($query)) {
            return response()->json(['RspCode' => '97', 'Message' => 'Invalid signature']);
        }

        $order = Order::where('gateway_txn_ref', $query['vnp_TxnRef'] ?? '')->first();
        if (!$order) {
            return response()->json(['RspCode' => '01', 'Message' => 'Order not found']);
        }

        // Số tiền phải khớp (VNPay gửi vnp_Amount đã nhân 100). Không kiểm là mở đường
        // cho việc trả 1.000đ rồi được chốt một hóa đơn 500.000đ.
        $canThu = (int) round(max(0, (int) $order->subtotal - (int) ($order->discount_amount ?? 0)));
        if ((int) ($query['vnp_Amount'] ?? -1) !== $canThu * 100) {
            return response()->json(['RspCode' => '04', 'Message' => 'Invalid amount']);
        }

        if (($query['vnp_ResponseCode'] ?? null) !== '00') {
            // Khách hủy hoặc trả hỏng: đơn quay về chờ, thu ngân đổi cách thu khác.
            // KHÔNG hủy đơn — món đã pha rồi, khách vẫn đứng đó.
            $order->update(['payment_status' => 'failed']);
            return response()->json(['RspCode' => '00', 'Message' => 'Confirmed']);
        }

        $shop = Shop::find($order->shop_id);
        if (!$shop) {
            Log::error('[thanh-toan] IPN đơn bán hàng: không tìm thấy quán của đơn', [
                'order_id' => (string) $order->id, 'shop_id' => (string) $order->shop_id,
            ]);
            return response()->json(['RspCode' => '01', 'Message' => 'Shop not found']);
        }

        $maPhieu = $this->chotDon($shop, $order, [
            'payment_method' => 'vnpay',
            'discount'       => (int) ($order->discount_amount ?? 0),
            'total'          => $canThu,
            'cash_received'  => null,
            'change_amount'  => null,
            // Thu qua cổng thì KHÔNG có thu ngân nào cầm tiền — để trống thay vì gán
            // bừa cho chủ quán, không thì báo cáo đối ca đổ nhầm doanh số cho họ.
            'paid_by'        => null,
        ]);

        if ($maPhieu === null) {
            // Đơn đã chốt trước đó (IPN gọi hai lần là chuyện bình thường của VNPay).
            // Vẫn báo '00': đã xử lý xong, đừng gọi lại nữa.
            return response()->json(['RspCode' => '00', 'Message' => 'Confirmed']);
        }

        return response()->json(['RspCode' => '00', 'Message' => 'Confirmed']);
    }
}
