<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\RunsAtomically;
use App\Models\PackagePayment;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionActivator;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    use RunsAtomically;

    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'admin']);
    }

    public function index()
    {
        return response()->json(PackagePayment::with('subscription.user', 'subscription.package', 'user', 'package')->get());
    }

    public function approve(PackagePayment $payment, SubscriptionActivator $activator)
    {
        $this->atomic(function () use ($payment, $activator) {
            $activator->markPaidAndActivate($payment);
        });

        return response()->json($payment->load('subscription'));
    }

    public function reject(PackagePayment $payment)
    {
        $this->atomic(function () use ($payment) {
            $payment->update(['payment_status' => 'rejected', 'paid_at' => null]);

            $sub = $payment->subscription;

            if ($payment->action_type === 'new') {
                $sub->update([
                    'status' => 'cancelled',
                    'is_pending_review' => false,
                ]);
            } elseif ($payment->action_type === 'upgrade') {
                $sub->update([
                    'status' => 'cancelled',
                    'is_pending_review' => false,
                ]);
                // Khôi phục subscription cũ nếu còn hạn
                if ($payment->previous_subscription_id) {
                    $oldSub = Subscription::find($payment->previous_subscription_id);
                    if ($oldSub && $oldSub->end_date && $oldSub->end_date->greaterThan(now())) {
                        $oldSub->update(['status' => 'active']);
                    }
                }
                // #4: Upgrade bị từ chối -> không phát sinh hoàn tiền nữa
                if ($payment->refund_status === 'pending') {
                    $payment->update(['refund_status' => 'rejected']);
                }
            } elseif ($payment->action_type === 'renew') {
                // Rollback end_date về previous_end_date
                $updateData = ['is_pending_review' => false];
                if ($payment->previous_end_date) {
                    $updateData['end_date'] = $payment->previous_end_date;
                }
                $sub->update($updateData);
            }
        });

        return response()->json($payment);
    }

    /**
     * #4: Admin xác nhận đã hoàn tiền phần thời gian còn lại của gói cũ.
     */
    public function approveRefund(Request $request, PackagePayment $payment)
    {
        if ($payment->refund_status !== 'pending') {
            return response()->json(['message' => 'Giao dịch này không có khoản hoàn tiền đang chờ xử lý.'], 400);
        }

        $validated = $request->validate([
            'refund_note' => 'nullable|string|max:500',
        ]);

        $payment->update([
            'refund_status' => 'approved',
            'refunded_at'   => now(),
            'refund_note'   => $validated['refund_note'] ?? $payment->refund_note,
        ]);

        return response()->json($payment->load('subscription.user', 'subscription.package'));
    }

    /**
     * #4: Admin từ chối khoản hoàn tiền.
     */
    public function rejectRefund(Request $request, PackagePayment $payment)
    {
        if ($payment->refund_status !== 'pending') {
            return response()->json(['message' => 'Giao dịch này không có khoản hoàn tiền đang chờ xử lý.'], 400);
        }

        $validated = $request->validate([
            'refund_note' => 'nullable|string|max:500',
        ]);

        $payment->update([
            'refund_status' => 'rejected',
            'refund_note'   => $validated['refund_note'] ?? $payment->refund_note,
        ]);

        return response()->json($payment->load('subscription.user', 'subscription.package'));
    }

    public function reset(PackagePayment $payment)
    {
        $payment->update(['payment_status' => 'pending', 'paid_at' => null]);

        $sub = $payment->subscription;
        $sub->update([
            'is_pending_review' => true,
        ]);

        return response()->json($payment->load('subscription.user', 'subscription.package'));
    }

    public function update(Request $request, PackagePayment $payment)
    {
        $validated = $request->validate([
            'amount' => 'sometimes|numeric|min:0',
            'note' => 'nullable|string|max:500',
        ]);

        $payment->update($validated);

        return response()->json($payment->load('subscription.user', 'subscription.package'));
    }
}
