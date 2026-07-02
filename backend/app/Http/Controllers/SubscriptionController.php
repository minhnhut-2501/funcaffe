<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use App\Models\Package;
use App\Models\TimeSubscription;
use App\Models\PackagePayment;
use App\Models\User;
use App\Http\Controllers\Concerns\RunsAtomically;
use App\Services\VnpayService;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    use RunsAtomically;

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
     * #4: Tính số tiền hoàn lại tương ứng phần thời gian còn lại của gói cũ
     * (pro-rata theo số ngày chưa dùng). Trả về số tiền làm tròn, tối thiểu 0.
     */
    private function calculateProratedRefund($oldSub): float
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

    public function index(Request $request)
    {
        return response()->json($request->user()->subscriptions()->with('package', 'packagePayments')->get());
    }

    public function active(Request $request)
    {
        $subscription = $request->user()->subscriptions()
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
    public function payments(Request $request)
    {
        $payments = PackagePayment::where('user_id', (string) $request->user()->id)
            ->with('package')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($payments);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'package_id' => 'required|string',
            'time_subscription_id' => 'nullable|string',
            'payment_method' => 'required|string|in:cash,bank_transfer,qr_code,e_wallet,vnpay',
            'note' => 'nullable|string|max:500',
        ]);

        $package = Package::findOrFail($validated['package_id']);
        $user = $request->user();

        // Kiểm tra pending payment
        $hasPendingPayment = PackagePayment::where('user_id', (string) $user->id)
            ->where('payment_status', 'pending')
            ->exists();

        if ($hasPendingPayment) {
            return response()->json([
                'message' => 'Bạn đang có giao dịch chờ admin kiểm tra. Vui lòng chờ xử lý trước khi thực hiện thao tác mới.'
            ], 400);
        }

        // Lấy time_subscription để tính giá và duration
        $timeSub = null;
        $amount = 0;
        $startDate = now();

        if ($package->is_trial) {
            // Fun Free: mặc định 7 ngày, giá 0
            $endDate = $startDate->copy()->addDays(7);
            $amount = 0;
        } else {
            if (empty($validated['time_subscription_id'])) {
                return response()->json(['message' => 'Vui lòng chọn thời hạn gói.'], 400);
            }
            $timeSub = TimeSubscription::findOrFail($validated['time_subscription_id']);
            $amount = $timeSub->price;
            $durationValue = $timeSub->duration_value;
            $durationUnit = $timeSub->duration_unit;
            $endDate = $durationUnit === 'day'
                ? $startDate->copy()->addDays($durationValue)
                : $startDate->copy()->addMonths($durationValue);
        }

        // Kiểm tra trial usage
        if ($package->is_trial) {
            if ($user->has_used_free_trial) {
                return response()->json(['message' => 'Bạn đã sử dụng gói dùng thử trước đó.'], 400);
            }
        }

        // Tìm subscription active hiện tại
        $activeSub = $user->subscriptions()
            ->where('status', 'active')
            ->latest()
            ->first();

        $now = now();

        // Tạo transaction code
        $todayStr = $now->format('Ymd');
        $paymentCount = PackagePayment::where('transaction_code', 'like', "TXN-{$todayStr}-%")->count() + 1;
        $txnCode = 'TXN-' . $todayStr . '-' . str_pad($paymentCount, 4, '0', STR_PAD_LEFT);

        if (!$activeSub) {
            // A. Chưa có subscription active -> NEW
            $isTrial = $package->is_trial;
            $subscriptionStatus = 'active';
            $isPendingReview = !$isTrial;
            $paymentStatus = $isTrial ? 'paid' : 'pending';

            $subscription = $this->atomic(function () use (
                $user, $package, $timeSub, $startDate, $endDate, $amount,
                $subscriptionStatus, $isPendingReview, $paymentStatus, $txnCode,
                $validated, $now, $isTrial
            ) {
                $subscription = $user->subscriptions()->create([
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'package_name_snapshot' => $package->name,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'subtotal' => $amount,
                    'total_amount' => $amount,
                    'status' => $subscriptionStatus,
                    'action_type' => 'new',
                    'previous_subscription_id' => null,
                    'is_pending_review' => $isPendingReview,
                ]);

                $subscription->packagePayments()->create([
                    'user_id' => (string) $user->id,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'amount' => $amount,
                    'payment_method' => $validated['payment_method'],
                    'payment_status' => $paymentStatus,
                    'transaction_code' => $txnCode,
                    'paid_at' => $isTrial ? $now : null,
                    'note' => $validated['note'] ?? null,
                    'action_type' => 'new',
                    'previous_subscription_id' => null,
                    'previous_end_date' => null,
                    'refund_amount' => 0,
                    'refund_status' => 'none',
                ]);

                // BUG-04 FIX: Set has_used_free_trial = true khi user dùng Fun Free
                if ($isTrial) {
                    $user->update(['has_used_free_trial' => true]);
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
            // B. UPGRADE
            // #4: Tính tiền hoàn lại cho phần thời gian còn lại của gói cũ.
            // Số tiền này CHỜ admin xem và xác nhận (refund_status = pending).
            $refundAmount = $this->calculateProratedRefund($activeSub);
            $refundStatus = $refundAmount > 0 ? 'pending' : 'none';

            $subscription = $this->atomic(function () use (
                $user, $package, $timeSub, $startDate, $endDate, $amount,
                $txnCode, $validated, $activeSub, $refundAmount, $refundStatus
            ) {
                // Cancel sub cũ
                $activeSub->update(['status' => 'cancelled']);

                // Tạo sub mới
                $subscription = $user->subscriptions()->create([
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'package_name_snapshot' => $package->name,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'subtotal' => $amount,
                    'total_amount' => $amount,
                    'status' => 'active',
                    'action_type' => 'upgrade',
                    'previous_subscription_id' => (string) $activeSub->id,
                    'is_pending_review' => true,
                ]);

                $subscription->packagePayments()->create([
                    'user_id' => (string) $user->id,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'amount' => $amount,
                    'payment_method' => $validated['payment_method'],
                    'payment_status' => 'pending',
                    'transaction_code' => $txnCode,
                    'paid_at' => null,
                    'note' => $validated['note'] ?? null,
                    'action_type' => 'upgrade',
                    'previous_subscription_id' => (string) $activeSub->id,
                    'previous_end_date' => null,
                    'refund_amount' => $refundAmount,
                    'refund_status' => $refundStatus,
                ]);

                return $subscription;
            });

            return $this->respondSubscription($subscription, 201, $amount, $txnCode, $request);
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
                $activeSub, $newEndDate, $user, $package, $timeSub, $amount,
                $validated, $txnCode, $previousEndDate
            ) {
                // Cập nhật subscription hiện tại
                $activeSub->update([
                    'end_date' => $newEndDate,
                    'is_pending_review' => true,
                    'action_type' => 'renew',
                ]);

                // Tạo package_payment
                $activeSub->packagePayments()->create([
                    'user_id' => (string) $user->id,
                    'package_id' => (string) $package->id,
                    'time_subscription_id' => $timeSub ? (string) $timeSub->id : null,
                    'amount' => $amount,
                    'payment_method' => $validated['payment_method'],
                    'payment_status' => 'pending',
                    'transaction_code' => $txnCode,
                    'paid_at' => null,
                    'note' => $validated['note'] ?? null,
                    'action_type' => 'renew',
                    'previous_subscription_id' => (string) $activeSub->id,
                    'previous_end_date' => $previousEndDate,
                    'refund_amount' => 0,
                    'refund_status' => 'none',
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
