<?php

namespace App\Services;

use App\Models\Cafe;
use App\Models\PackagePayment;
use App\Models\Subscription;
use App\Models\TimeSubscription;
use App\Models\User;

/**
 * Đánh dấu một giao dịch gói là đã thanh toán và kích hoạt subscription tương ứng.
 *
 * Dùng chung cho:
 *  - Admin duyệt tay (Admin/PaymentController::approve)
 *  - Callback tự động từ cổng thanh toán (VNPay return/IPN)
 *
 * Idempotent: gọi lại trên một giao dịch đã 'paid' sẽ không cộng hạn lần nữa.
 */
class SubscriptionActivator
{
    /**
     * Các trạng thái CÒN kích hoạt được khi cổng thanh toán xác nhận đã thu tiền.
     *
     * 'failed' có mặt ở đây là CÓ CHỦ Ý. Trạng thái đó do CHÍNH HỆ THỐNG đặt khi dọn
     * các đơn cổng bị bỏ dở (SubscriptionController::store) — nó chỉ là phỏng đoán
     * "khách chắc đã bỏ", không phải sự thật về dòng tiền. Khi cổng gửi callback đã
     * ký báo thu tiền thành công thì đó mới là sự thật, và nó phải thắng phỏng đoán.
     *
     * Nếu không cho 'failed' đi qua, kịch bản sau làm khách mất tiền: khách bấm mua
     * lần hai trong lúc tab cổng thanh toán còn mở -> đơn đầu bị đánh 'failed' ->
     * khách trả tiền trên tab cũ -> tiền vào mà gói không được cấp.
     *
     * 'paid' và 'rejected' vẫn bị chặn: 'paid' để không cộng hạn hai lần, 'rejected'
     * vì đó là quyết định dứt khoát (khách huỷ trên cổng / admin từ chối).
     */
    private const ACTIVATABLE_STATUSES = ['pending', 'failed'];

    /**
     * @return bool true nếu vừa kích hoạt; false nếu đã xử lý dứt điểm trước đó.
     */
    public function markPaidAndActivate(PackagePayment $payment): bool
    {
        if (!in_array($payment->payment_status, self::ACTIVATABLE_STATUSES, true)) {
            return false; // đã paid/rejected rồi -> không làm lại
        }

        $payment->update(['payment_status' => 'paid', 'paid_at' => now()]);

        $sub = $payment->subscription;
        if ($sub) {
            // Với cổng online (VNPay/MoMo...), các side-effect được HOÃN ở store (để không cấp gói khi khách chưa trả).
            // Khi cổng xác nhận thanh toán, áp dụng chúng tại đây.
            if (in_array($payment->payment_method, PackagePayment::ONLINE_GATEWAYS, true)) {
                if ($payment->action_type === 'upgrade' && $payment->previous_subscription_id) {
                    // Nâng cấp: hủy gói cũ khi gói mới chính thức được thanh toán.
                    $oldSub = Subscription::find($payment->previous_subscription_id);
                    if ($oldSub) {
                        $oldSub->update(['status' => 'cancelled']);
                    }
                } elseif ($payment->action_type === 'renew') {
                    // Gia hạn: cộng thời hạn mới (tính từ previous_end_date hoặc now).
                    // total_amount phải cộng dồn CÙNG LÚC với end_date — xem ghi chú ở
                    // SubscriptionController nhánh RENEW.
                    $sub->update([
                        'end_date' => $this->computeRenewEndDate($payment),
                        'total_amount' => (float) ($sub->total_amount ?? 0) + (float) $payment->amount,
                    ]);
                }
            }

            if ($sub->status !== 'active') {
                $sub->update(['status' => 'active']);
            }

            // BUG-05 FIX: Set has_used_free_trial khi kích hoạt gói trial dạng 'new'.
            // Đánh dấu ở CẢ hai cấp: trên QUÁN (mỗi quán một lần) và trên TÀI KHOẢN
            // (mỗi tài khoản một lần). Thiếu vế tài khoản thì chủ quán chỉ cần tạo
            // quán mới là lại được 7 ngày Pro Max, lặp vô hạn.
            if ($payment->action_type === 'new') {
                $pkg = $sub->package;
                if ($pkg && $pkg->is_trial) {
                    $cafe = Cafe::find($payment->cafe_id ?? $sub->cafe_id);
                    if ($cafe) {
                        $cafe->update(['has_used_free_trial' => true]);
                    }
                    $user = User::find($payment->user_id);
                    if ($user) {
                        $user->update(['has_used_free_trial' => true]);
                    }
                }
            }
        }

        return true;
    }

    /**
     * Tính end_date mới khi gia hạn (VNPay): cộng thời hạn của gói vào ngày kết thúc cũ
     * nếu còn hiệu lực, ngược lại tính từ hiện tại.
     */
    private function computeRenewEndDate(PackagePayment $payment): \Illuminate\Support\Carbon
    {
        $now = now();
        $prevEnd = $payment->previous_end_date;
        $baseDate = ($prevEnd && $prevEnd->greaterThan($now)) ? $prevEnd->copy() : $now->copy();

        $timeSub = $payment->time_subscription_id
            ? TimeSubscription::find($payment->time_subscription_id)
            : null;

        if (!$timeSub) {
            return $baseDate->addMonth();
        }

        return $timeSub->duration_unit === 'day'
            ? $baseDate->addDays((int) $timeSub->duration_value)
            : $baseDate->addMonths((int) $timeSub->duration_value);
    }

    /**
     * Từ chối một giao dịch pending và rollback subscription về trạng thái trước đó.
     *
     * Dùng chung cho:
     *  - Admin từ chối tay (Admin/PaymentController::reject)
     *  - Người dùng hủy/thất bại trên cổng thanh toán (VNPay return code != '00')
     *
     * Idempotent: chỉ xử lý khi payment đang ở trạng thái 'pending'.
     *
     * @return bool true nếu vừa từ chối; false nếu đã xử lý trước đó (không phải pending).
     */
    public function rejectAndRollback(PackagePayment $payment): bool
    {
        if ($payment->payment_status !== 'pending') {
            return false; // đã paid/rejected rồi -> không làm lại
        }

        $payment->update(['payment_status' => 'rejected', 'paid_at' => null]);

        $sub = $payment->subscription;
        if (!$sub) {
            return true;
        }

        if ($payment->action_type === 'new') {
            $sub->update(['status' => 'cancelled']);
        } elseif ($payment->action_type === 'upgrade') {
            $sub->update(['status' => 'cancelled']);
            // Khôi phục subscription cũ nếu còn hạn
            if ($payment->previous_subscription_id) {
                $oldSub = Subscription::find($payment->previous_subscription_id);
                if ($oldSub && $oldSub->end_date && $oldSub->end_date->greaterThan(now())) {
                    $oldSub->update(['status' => 'active']);
                }
            }
            // Khoản cấn trừ đi liền với subscription mới đã bị hủy ở trên, nên không
            // cần đụng credit_amount: nó chỉ còn giá trị lịch sử (biên lai).
        } elseif ($payment->action_type === 'renew') {
            // Rollback end_date về previous_end_date
            $updateData = [];
            if ($payment->previous_end_date) {
                $updateData['end_date'] = $payment->previous_end_date;
            }
            // Chỉ luồng DUYỆT TAY mới cộng end_date + total_amount ngay tại store();
            // luồng cổng online hoãn cả hai tới markPaidAndActivate() nên KHÔNG có gì để trừ.
            // Trừ nhầm ở đây sẽ tạo ra đúng kiểu lệch mà thay đổi này đang sửa.
            if (!in_array($payment->payment_method, PackagePayment::ONLINE_GATEWAYS, true)) {
                $updateData['total_amount'] = max(0, (float) ($sub->total_amount ?? 0) - (float) $payment->amount);
            }
            $sub->update($updateData);
        }

        return true;
    }
}
