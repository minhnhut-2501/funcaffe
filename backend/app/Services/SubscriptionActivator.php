<?php

namespace App\Services;

use App\Models\PackagePayment;
use App\Models\User;

/**
 * Đánh dấu một giao dịch gói là đã thanh toán và kích hoạt subscription tương ứng.
 *
 * Dùng chung cho:
 *  - Admin duyệt tay (Admin/PaymentController::approve)
 *  - Callback tự động từ cổng thanh toán (VNPay return/IPN)
 *
 * Idempotent: chỉ xử lý khi payment đang ở trạng thái 'pending'.
 */
class SubscriptionActivator
{
    /**
     * @return bool true nếu vừa kích hoạt; false nếu đã xử lý trước đó (không phải pending).
     */
    public function markPaidAndActivate(PackagePayment $payment): bool
    {
        if ($payment->payment_status !== 'pending') {
            return false; // đã paid/rejected rồi -> không làm lại
        }

        $payment->update(['payment_status' => 'paid', 'paid_at' => now()]);

        $sub = $payment->subscription;
        if ($sub) {
            $sub->update(['is_pending_review' => false]);
            if ($sub->status !== 'active') {
                $sub->update(['status' => 'active']);
            }

            // BUG-05 FIX: Set has_used_free_trial = true khi kích hoạt gói trial dạng 'new'
            if ($payment->action_type === 'new') {
                $pkg = $sub->package;
                if ($pkg && $pkg->is_trial) {
                    $user = User::find($sub->user_id);
                    if ($user) {
                        $user->update(['has_used_free_trial' => true]);
                    }
                }
            }
        }

        return true;
    }
}
