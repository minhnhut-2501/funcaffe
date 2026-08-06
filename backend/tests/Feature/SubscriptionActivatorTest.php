<?php

namespace Tests\Feature;

use App\Models\Cafe;
use App\Models\Package;
use App\Models\PackagePayment;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionActivator;
use Illuminate\Support\Facades\Hash;

/**
 * Chốt chặn cho luồng tiền vào: callback của cổng thanh toán.
 *
 * Hai lỗi đối nghịch cần chặn cùng lúc, và mỗi lần sửa một cái là dễ làm hỏng cái kia:
 *  - Kích hoạt HAI LẦN  -> khách được cộng hạn gấp đôi (Return URL và IPN cùng về, hoặc
 *                          khách bấm F5 lại trang kết quả).
 *  - Kích hoạt HỤT      -> khách trả tiền mà không có gói (đơn bị đoạn dọn dẹp ở
 *                          SubscriptionController::store đánh dấu 'failed' trong lúc
 *                          khách còn đang trả tiền ở tab cổng thanh toán).
 */
class SubscriptionActivatorTest extends MongoTestCase
{
    protected array $collections = ['users', 'cafes', 'packages', 'subscriptions', 'package_payments'];

    private function makePayment(string $paymentStatus, string $subscriptionStatus = 'pending'): PackagePayment
    {
        $user = User::create([
            'full_name' => 'Chủ quán kiểm thử',
            'email' => 'kiemthu-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);

        $cafe = $user->cafes()->create(['name' => 'Quán kiểm thử', 'status' => 'open']);

        $package = Package::create([
            'name' => 'Pro Max', 'type' => 'promax', 'level' => 2,
            'status' => 'active', 'is_trial' => false, 'can_use_ai' => true,
        ]);

        $subscription = Subscription::create([
            'cafe_id' => (string) $cafe->id,
            'package_id' => (string) $package->id,
            'package_name_snapshot' => $package->name,
            'start_date' => now(),
            'end_date' => now()->addMonth(),
            'total_amount' => 199_000,
            'status' => $subscriptionStatus,
        ]);

        return $subscription->packagePayments()->create([
            'user_id' => (string) $user->id,
            'cafe_id' => (string) $cafe->id,
            'package_id' => (string) $package->id,
            'amount' => 199_000,
            'payment_method' => 'vnpay',
            'payment_status' => $paymentStatus,
            'transaction_code' => 'TXN-TEST-' . uniqid(),
            'action_type' => 'new',
        ]);
    }

    public function test_kich_hoat_don_dang_cho_thi_cap_goi(): void
    {
        $payment = $this->makePayment('pending');

        $this->assertTrue(app(SubscriptionActivator::class)->markPaidAndActivate($payment));
        $this->assertSame('paid', $payment->fresh()->payment_status);
        $this->assertSame('active', $payment->subscription->fresh()->status);
    }

    public function test_goi_lan_hai_khong_cap_goi_them_lan_nua(): void
    {
        // Kịch bản thật: IPN về trước, rồi trình duyệt mới tới Return URL. Hoặc khách
        // bấm F5 trang kết quả — toàn bộ query string được gửi lại và chữ ký vẫn hợp lệ.
        $payment = $this->makePayment('pending');
        $activator = app(SubscriptionActivator::class);

        $this->assertTrue($activator->markPaidAndActivate($payment));
        $endDateSauLanDau = $payment->subscription->fresh()->end_date;

        $this->assertFalse($activator->markPaidAndActivate($payment->fresh()));
        $this->assertEquals($endDateSauLanDau, $payment->subscription->fresh()->end_date);
    }

    public function test_don_bi_danh_dau_that_bai_van_duoc_cap_goi_khi_cong_xac_nhan_thu_tien(): void
    {
        // Đây là bug E-01. Đoạn dọn dẹp trong store() đánh 'failed' cho đơn cổng đang
        // chờ; nếu khách vẫn hoàn tất thanh toán ở tab cũ thì tiền ĐÃ vào. Callback đã
        // ký của cổng là sự thật về dòng tiền và phải thắng phỏng đoán của hệ thống.
        $payment = $this->makePayment('failed', 'cancelled');

        $this->assertTrue(app(SubscriptionActivator::class)->markPaidAndActivate($payment));
        $this->assertSame('paid', $payment->fresh()->payment_status);
        $this->assertSame('active', $payment->subscription->fresh()->status, 'Gói bị hủy phải được khôi phục khi tiền đã vào');
    }

    public function test_don_da_bi_tu_choi_thi_khong_kich_hoat(): void
    {
        // 'rejected' là quyết định dứt khoát (khách hủy trên cổng / admin từ chối),
        // khác hẳn 'failed' vốn chỉ là phỏng đoán khi dọn đơn bỏ dở.
        $payment = $this->makePayment('rejected', 'cancelled');

        $this->assertFalse(app(SubscriptionActivator::class)->markPaidAndActivate($payment));
        $this->assertSame('rejected', $payment->fresh()->payment_status);
    }

    public function test_quan_dung_goi_dung_thu_thi_danh_dau_ca_quan_lan_tai_khoan(): void
    {
        // Thiếu vế TÀI KHOẢN thì chủ quán chỉ cần tạo quán mới là lại có 7 ngày Pro Max.
        $payment = $this->makePayment('pending');
        Package::where('_id', $payment->package_id)->update(['is_trial' => true]);

        app(SubscriptionActivator::class)->markPaidAndActivate($payment->fresh());

        $this->assertTrue((bool) Cafe::find($payment->cafe_id)->has_used_free_trial);
        $this->assertTrue((bool) User::find($payment->user_id)->has_used_free_trial);
    }
}
