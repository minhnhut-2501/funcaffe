<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RunsAtomically;
use App\Models\PackagePayment;
use App\Services\SubscriptionActivator;
use App\Services\VnpayService;
use Illuminate\Http\Request;

/**
 * Xử lý callback từ cổng thanh toán VNPay (luồng chủ quán trả tiền gói).
 * Các endpoint này PUBLIC (VNPay/trình duyệt gọi không kèm token).
 */
class PaymentGatewayController extends Controller
{
    use RunsAtomically;

    public function __construct(
        private VnpayService $vnpay,
        private SubscriptionActivator $activator,
    ) {}

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
        $frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');
        $resultBase = $frontend . '/user/subscription/payment-result';

        $code = $query['vnp_ResponseCode'] ?? null;

        if (!$this->vnpay->validateSignature($query)) {
            return redirect()->away($resultBase . '?status=fail&code=invalid_signature');
        }

        $payment = PackagePayment::where('transaction_code', $query['vnp_TxnRef'] ?? '')->first();
        if (!$payment) {
            return redirect()->away($resultBase . '?status=fail&code=not_found');
        }

        if ($code === '00') {
            $this->atomic(function () use ($payment, $query) {
                $payment->update([
                    'gateway_txn_no'   => $query['vnp_TransactionNo'] ?? null,
                    'gateway_bank_code' => $query['vnp_BankCode'] ?? null,
                ]);
                $this->activator->markPaidAndActivate($payment);
            });

            return redirect()->away($resultBase . '?status=success&code=00');
        }

        // Người dùng hủy (code 24) hoặc thanh toán thất bại: từ chối giao dịch và
        // rollback subscription để nó KHÔNG lọt vào hàng chờ duyệt của admin.
        $this->atomic(function () use ($payment) {
            $this->activator->rejectAndRollback($payment);
        });

        return redirect()->away($resultBase . '?status=fail&code=' . urlencode((string) $code));
    }

    /**
     * IPN URL (server-to-server). Dùng khi deploy public. Trả JSON theo chuẩn VNPay.
     */
    public function vnpayIpn(Request $request)
    {
        $query = $request->query();

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
            $this->atomic(function () use ($payment, $query) {
                $payment->update([
                    'gateway_txn_no'    => $query['vnp_TransactionNo'] ?? null,
                    'gateway_bank_code' => $query['vnp_BankCode'] ?? null,
                ]);
                $this->activator->markPaidAndActivate($payment);
            });

            return response()->json(['RspCode' => '00', 'Message' => 'Confirm Success']);
        }

        $this->atomic(function () use ($payment) {
            $this->activator->rejectAndRollback($payment);
        });
        return response()->json(['RspCode' => '00', 'Message' => 'Confirm Success']);
    }
}
