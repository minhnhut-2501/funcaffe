<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use App\Models\Package;
use App\Models\TimeSubscription;
use App\Models\PackagePayment;
use App\Models\User;
use App\Models\Cafe;
use App\Http\Controllers\Concerns\RunsAtomically;
use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use App\Services\VnpayService;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    use RunsAtomically;
    use ChecksCafeOwnership;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * Trả về subscription cho client. Nếu phương thức là VNPay và có số tiền phải trả,
     * đính kèm payment_url để frontend chuyển hướng sang cổng thanh toán.
     */
    private function respondSubscription($subscription, int $statusCode, float $amount, string $txnCode, Request $request)
    {
        $data = $subscription->load('package')->toArray();

        if (($request->input('payment_method') === 'vnpay') && $amount > 0) {
            $orderInfo = 'Thanh toan goi ' . preg_replace('/[^A-Za-z0-9 ]/', '', $subscription->package_name_snapshot ?? 'FunCafe');
            $data['payment_url'] = app(VnpayService::class)->buildPaymentUrl(
                $txnCode,
                (int) round($amount),
                $orderInfo,
                (string) $request->ip()
            );
        }

        return response()->json($data, $statusCode);
    }

    /**
     * Tính giá trị còn lại của gói cũ để CẤN TRỪ vào giá gói nâng cấp
     * (pro-rata theo số ngày chưa dùng). Trả về số tiền làm tròn, tối thiểu 0.
     *
     * Dựa vào $oldSub->total_amount = TỔNG tiền đã trả cho chu kỳ start_date -> end_date.
     * Mọi nhánh kéo dài end_date PHẢI cộng dồn total_amount tương ứng, nếu không tỉ lệ
     * ở đây sẽ chia số tiền cũ cho khoảng thời gian đã dài ra -> cấn trừ thiếu cho khách.
     */
    private function calculateProratedCredit($oldSub): float
    {
        if (!$oldSub || !$oldSub->start_date || !$oldSub->end_date) {
            return 0.0;
        }

        $paid = (float) ($oldSub->total_amount ?? 0);
        if ($paid <= 0) {
            return 0.0; // Gói miễn phí (Fun Free) không hoàn tiền
        }

        $now = now();
        if ($oldSub->end_date->lessThanOrEqualTo($now)) {
            return 0.0; // Đã hết hạn -> không còn gì để hoàn
        }

        $totalSeconds = $oldSub->start_date->diffInSeconds($oldSub->end_date);
        if ($totalSeconds <= 0) {
            return 0.0;
        }

        $remainingSeconds = $now->diffInSeconds($oldSub->end_date);
        $ratio = min(1, max(0, $remainingSeconds / $totalSeconds));

        return round($paid * $ratio);
    }

    /**
     * B7: sinh mã giao dịch TXN-yyyymmdd-#### không trùng — count()+1 rồi dò
     * tiếp tới số chưa dùng (count đơn thuần có thể trùng khi request song song).
     */
    private function nextTransactionCode(\Illuminate\Support\Carbon $now): string
    {
        $todayStr = $now->format('Ymd');
        $seq = PackagePayment::where('transaction_code', 'like', "TXN-{$todayStr}-%")->count() + 1;
        do {
            $txnCode = 'TXN-' . $todayStr . '-' . str_pad($seq++, 4, '0', STR_PAD_LEFT);
        } while (PackagePayment::where('transaction_code', $txnCode)->exists());

        return $txnCode;
    }

    public function index(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $subscriptions = Subscription::where('cafe_id', (string) $cafe->id)
            ->with('package', 'packagePayments')
            ->get();

        return response()->json($subscriptions);
    }

    public function active(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $subscription = Subscription::where('cafe_id', (string) $cafe->id)
            ->where('status', 'active')
            ->with('package', 'packagePayments')
            ->latest()
            ->first();

        return response()->json($subscription);
    }

    /**
     * Lịch sử thanh toán gói của chính user (để user theo dõi trạng thái:
     * chờ duyệt / đã thanh toán / bị từ chối + thông tin hoàn tiền nếu có).
     */
    public function payments(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $payments = PackagePayment::where('cafe_id', (string) $cafe->id)
            // Giao dịch qua cổng online (VNPay/MoMo...) CHỈ hiện khi ĐÃ thanh toán (paid).
            // Đơn đang chờ cổng / bị hủy / thất bại đều không hiện (tránh hiểu nhầm "đã thanh toán").
            // Các phương thức khác vẫn hiện đầy đủ mọi trạng thái.
            ->where(function ($q) {
                $q->whereNotIn('payment_method', PackagePayment::ONLINE_GATEWAYS)
                  ->orWhere('payment_status', 'paid');
            })
            ->with('package')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($payments);
    }

    public function store(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $validated = $request->validate([
            'package_id' => 'required|string',
            'time_subscription_id' => 'nullable|string',
            'payment_method' => 'required|string|in:cash,bank_transfer,qr_code,e_wallet,vnpay',
            'note' => 'nullable|string|max:500',
        ]);

        $package = Package::findOrFail($validated['package_id']);
        $user = $request->user();
        $cafeId = (string) $cafe->id;

        // Dọn đơn cổng online (VNPay/MoMo) 'pending' bị bỏ dở CỦA CHÍNH QUÁN NÀY: chúng tự
        // kích hoạt qua callback, KHÔNG chờ admin — nên không được chặn thao tác mới. Bắt đầu
        // đăng ký mới = từ bỏ lần thử cũ: đánh dấu 'failed' và hủy subscription 'pending' treo.
        // ĐA QUÁN: chỉ tác động quán này, tránh làm hỏng đơn pending của quán khác cùng chủ.
        PackagePayment::where('cafe_id', $cafeId)
            ->where('payment_status', 'pending')
            ->whereIn('payment_method', PackagePayment::ONLINE_GATEWAYS)
            ->update(['payment_status' => 'failed']);
        Subscription::where('cafe_id', $cafeId)->where('status', 'pending')->update(['status' => 'cancelled']);

        // Chỉ còn đơn 'pending' THỰC SỰ chờ admin (tiền mặt/chuyển khoản) của quán này mới chặn.
        $hasPendingPayment = PackagePayment::where('cafe_id', $cafeId)
            ->where('payment_status', 'pending')
            ->exists();

        if ($hasPendingPayment) {
            return response()->json([
                'message' => 'Quán này đang có giao dịch chờ admin kiểm tra. Vui lòng chờ xử lý trước khi thực hiện thao tác mới.'
            ], 400);
        }

        // Lấy time_subscription để tính giá và duration
        $timeSub = null;
        $subtotal = 0;      // giá gói CHƯA gồm VAT (niêm yết)
        $vatRate = (float) config('funcafe.vat_rate', 10); // %
        $vatAmount = 0;
        $amount = 0;        // số tiền thanh toán thực tế = subtotal + VAT
        $startDate = now();

        if ($package->is_trial) {
            // Fun Free: mặc định 7 ngày, giá 0 (không phát sinh VAT)
            $endDate = $startDate->copy()->addDays(7);
            $vatRate = 0;
        } else {
            if (empty($validated['time_subscription_id'])) {
                return response()->json(['message' => 'Vui lòng chọn thời hạn gói.'], 400);
            }
            $timeSub = TimeSubscription::findOrFail($validated['time_subscription_id']);
            $subtotal = (float) $timeSub->price;
            $vatAmount = round($subtotal * $vatRate / 100);
            $amount = $subtotal + $vatAmount;
            $durationValue = $timeSub->duration_value;
            $durationUnit = $timeSub->duration_unit;
            $endDate = $durationUnit === 'day'
                ? $startDate->copy()->addDays($durationValue)
                : $startDate->copy()->addMonths($durationValue);
        }

        // Kiểm tra trial usage — ĐA QUÁN: dùng thử tính theo QUÁN (mỗi quán 1 lần), không theo tài khoản.
        if ($package->is_trial) {
            if ($cafe->has_used_free_trial) {
                return response()->json(['message' => 'Quán này đã sử dụng gói dùng thử trước đó.'], 400);
            }
        }

        // Tìm subscription active hiện tại CỦA QUÁN NÀY
        $activeSub = Subscription::where('cafe_id', $cafeId)
            ->where('status', 'active')
            ->latest()
            ->first();

        $now = now();

        // Tạo transaction code (B7: dò tiếp tới số chưa dùng, tránh trùng khi request song song)
        $txnCode = $this->nextTransactionCode($now);

        // Cổng thanh toán online (VNPay/MoMo...) tự kích hoạt qua callback, không duyệt tay.
        $isGateway = in_array($validated['payment_method'], PackagePayment::ONLINE_GATEWAYS, true);

        if (!$activeSub) {
            // A. Chưa có subscription active -> NEW
            $isTrial = $package->is_trial;
            // Cổng online: GIỮ 'pending' (chưa cấp gói) tới khi cổng xác nhận thanh toán.
            // Tránh việc khách chọn cổng rồi back lại vẫn được kích hoạt.
            $subscriptionStatus = ($isTrial || !$isGateway) ? 'active' : 'pending';
            // Cổng online không đi qua duyệt tay của admin (kích hoạt tự động).
            $isPendingReview = !$isTrial && !$isGateway;
            $paymentStatus = $isTrial ? 'paid' : 'pending';

            $subscription = $this->atomic(function () use (
                $user, $cafe, $cafeId, $package, $timeSub, $startDate, $endDate, $amount,
                $subtotal, $vatRate, $vatAmount,
                $subscriptionStatus, $isPendingReview, $paymentStatus, $txnCode,
                $validated, $now, $isTrial
            ) {
                $subscription = $user->subscriptions()->create([
                    'cafe_id' => $cafeId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'package_name_snapshot' => $package->name,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'total_amount' => $amount,
                    'status' => $subscriptionStatus,
                    'is_pending_review' => $isPendingReview,
                ]);

                $subscription->packagePayments()->create([
                    'user_id' => (string) $user->id,
                    'cafe_id' => $cafeId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'subtotal' => $subtotal,
                    'vat_rate' => $vatRate,
                    'vat_amount' => $vatAmount,
                    'amount' => $amount,
                    'payment_method' => $validated['payment_method'],
                    'payment_status' => $paymentStatus,
                    'transaction_code' => $txnCode,
                    'paid_at' => $isTrial ? $now : null,
                    'note' => $validated['note'] ?? null,
                    'action_type' => 'new',
                    'previous_subscription_id' => null,
                    'previous_end_date' => null,
                    'credit_amount' => 0,
                    'credit_status' => 'none',
                ]);

                // Set has_used_free_trial = true khi quán dùng Fun Free (trial theo QUÁN)
                if ($isTrial) {
                    $cafe->update(['has_used_free_trial' => true]);
                }

                return $subscription;
            });

            return $this->respondSubscription($subscription, 201, $amount, $txnCode, $request);
        }

        // Có subscription active -> so sánh level
        $oldPackage = Package::find($activeSub->package_id);
        $oldLevel = $oldPackage ? ($oldPackage->level ?? 0) : 0;
        $newLevel = $package->level ?? 0;

        if ($newLevel > $oldLevel) {
            // B. UPGRADE — CẤN TRỪ THẲNG phần còn lại của gói cũ vào giá gói mới ("credit ngay").
            // Giá trị còn lại (pro-rata theo thời gian, đã gồm VAT) được TRỪ ngay vào số tiền
            // phải trả; KHÔNG tạo yêu cầu hoàn tiền chờ admin nữa. User chỉ trả phần chênh lệch.
            $grossAmount = $amount;                                            // giá gói mới (đã gồm VAT)
            $credit      = min($this->calculateProratedCredit($activeSub), $grossAmount); // không vượt quá giá gói mới
            $payable     = max(0, round($grossAmount - $credit));              // số tiền thực trả sau khi cấn trừ
            $creditStatus = $credit > 0 ? 'applied' : 'none';                  // 'applied' = đã cấn trừ trực tiếp

            // Nếu phần cấn trừ đã phủ hết giá gói mới (payable = 0) thì không cần qua cổng thanh toán:
            // kích hoạt ngay như luồng duyệt tay (admin xác nhận giao dịch 0đ).
            $gatewayCharge = $isGateway && $payable > 0;

            $subscription = $this->atomic(function () use (
                $user, $cafeId, $package, $timeSub, $startDate, $endDate, $payable,
                $subtotal, $vatRate, $vatAmount,
                $txnCode, $validated, $activeSub, $credit, $creditStatus, $gatewayCharge
            ) {
                // VNPay (có thu tiền): HOÃN hủy gói cũ tới khi thanh toán xác nhận (khách back lại -> giữ nguyên gói cũ).
                if (!$gatewayCharge) {
                    $activeSub->update(['status' => 'cancelled']);
                }

                // Tạo sub mới. VNPay -> 'pending' (chưa hiệu lực) tới khi cổng xác nhận.
                // total_amount = số THỰC TRẢ (đã cấn trừ) -> pro-rata lần nâng cấp sau tính đúng.
                $subscription = $user->subscriptions()->create([
                    'cafe_id' => $cafeId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'package_name_snapshot' => $package->name,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'total_amount' => $payable,
                    'status' => $gatewayCharge ? 'pending' : 'active',
                    'is_pending_review' => !$gatewayCharge,
                ]);

                $subscription->packagePayments()->create([
                    'user_id' => (string) $user->id,
                    'cafe_id' => $cafeId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'subtotal' => $subtotal,
                    'vat_rate' => $vatRate,
                    'vat_amount' => $vatAmount,
                    'amount' => $payable,
                    'payment_method' => $validated['payment_method'],
                    'payment_status' => 'pending',
                    'transaction_code' => $txnCode,
                    'paid_at' => null,
                    'note' => $validated['note'] ?? null,
                    'action_type' => 'upgrade',
                    'previous_subscription_id' => (string) $activeSub->id,
                    'previous_end_date' => null,
                    'credit_amount' => $credit,
                    'credit_status' => $creditStatus,
                ]);

                return $subscription;
            });

            return $this->respondSubscription($subscription, 201, $payable, $txnCode, $request);
        }

        if ($newLevel === $oldLevel) {
            // C. RENEW
            $previousEndDate = $activeSub->end_date;

            // BUG-06 FIX: Cộng trực tiếp duration vào previousEndDate nếu còn hiệu lực,
            // hoặc vào now() nếu đã hết hạn
            $baseDate = ($previousEndDate && $previousEndDate->greaterThan($now))
                ? $previousEndDate->copy()
                : $now->copy();

            if ($timeSub) {
                $durationValue = $timeSub->duration_value;
                $durationUnit = $timeSub->duration_unit;
                $newEndDate = $durationUnit === 'day'
                    ? $baseDate->addDays($durationValue)
                    : $baseDate->addMonths($durationValue);
            } else {
                $newEndDate = $baseDate->addMonths(1);
            }

            $this->atomic(function () use (
                $activeSub, $newEndDate, $user, $cafeId, $package, $timeSub, $amount,
                $subtotal, $vatRate, $vatAmount,
                $validated, $txnCode, $previousEndDate, $isGateway
            ) {
                // VNPay: HOÃN gia hạn end_date tới khi thanh toán xác nhận (khách back lại -> không cộng thêm ngày).
                // Gói hiện tại vẫn 'active' như cũ; end_date mới sẽ được áp khi cổng xác nhận (markPaidAndActivate).
                if (!$isGateway) {
                    $activeSub->update([
                        'end_date' => $newEndDate,
                        // total_amount = TỔNG tiền đã trả cho chu kỳ hiện hành (start_date -> end_date).
                        // Phải cộng dồn ĐÚNG THEO CẶP với end_date, nếu không calculateProratedCredit()
                        // sẽ chia số tiền cũ cho khoảng thời gian đã dài ra -> cấn trừ thiếu cho khách.
                        'total_amount' => (float) ($activeSub->total_amount ?? 0) + $amount,
                        'is_pending_review' => true,
                    ]);
                }

                // Tạo package_payment
                $activeSub->packagePayments()->create([
                    'user_id' => (string) $user->id,
                    'cafe_id' => $cafeId,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'subtotal' => $subtotal,
                    'vat_rate' => $vatRate,
                    'vat_amount' => $vatAmount,
                    'amount' => $amount,
                    'payment_method' => $validated['payment_method'],
                    'payment_status' => 'pending',
                    'transaction_code' => $txnCode,
                    'paid_at' => null,
                    'note' => $validated['note'] ?? null,
                    'action_type' => 'renew',
                    'previous_subscription_id' => (string) $activeSub->id,
                    'previous_end_date' => $previousEndDate,
                    'credit_amount' => 0,
                    'credit_status' => 'none',
                ]);
            });

            return $this->respondSubscription($activeSub->fresh(), 200, $amount, $txnCode, $request);
        }

        // D. DOWNGRADE - không cho phép
        return response()->json([
            'message' => 'Không thể hạ gói khi gói hiện tại còn hiệu lực.'
        ], 400);
    }

}
