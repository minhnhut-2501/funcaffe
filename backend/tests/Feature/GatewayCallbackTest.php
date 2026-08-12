<?php

namespace Tests\Feature;

use App\Models\Cafe;
use App\Models\Package;
use App\Models\PackagePayment;
use App\Models\Subscription;
use App\Models\TimeSubscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * Callback của hai cổng thanh toán — nơi tiền thật đổi chủ và cũng là nơi duy nhất
 * trong hệ thống mà NGƯỜI LẠ gọi được (endpoint public, không có token).
 *
 * Hai câu hỏi bài kiểm thử này giữ:
 *  1. Tự gõ một đường dẫn "thành công" có được cấp gói không? (phải: KHÔNG)
 *  2. Cổng gọi về hai lần thì gói có được cộng hạn hai lần không? (phải: KHÔNG)
 *
 * Câu thứ hai không phải tình huống hiếm: VNPay gửi Return URL cho trình duyệt VÀ
 * IPN cho máy chủ trên cùng một giao dịch, thường cách nhau vài phần nghìn giây.
 */
class GatewayCallbackTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'cafes', 'packages', 'time_subscriptions', 'subscriptions', 'package_payments',
    ];

    private const VNPAY_SECRET = 'TEST_HASH_SECRET_ABC123';
    private const MOMO_SECRET  = 'TEST_MOMO_SECRET_XYZ789';
    private const MOMO_ACCESS  = 'TEST_ACCESS_KEY';

    private User $user;
    private Cafe $cafe;
    private Package $goi;
    private TimeSubscription $thoiHan;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.vnpay', [
            'tmn_code' => 'TESTTMN', 'hash_secret' => self::VNPAY_SECRET,
            'url' => 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
            'return_url' => 'http://localhost:8000/api/payments/vnpay/return',
        ]);
        config()->set('services.momo', [
            'partner_code' => 'MOMOTEST', 'access_key' => self::MOMO_ACCESS, 'secret_key' => self::MOMO_SECRET,
            'endpoint' => 'https://test-payment.momo.vn/v2/gateway/api/create',
            'redirect_url' => 'http://localhost:8000/api/payments/momo/return',
            'ipn_url' => 'http://localhost:8000/api/payments/momo/ipn',
            'request_type' => 'captureWallet',
        ]);

        $this->user = User::create([
            'full_name' => 'Chủ quán trả tiền gói',
            'email' => 'pay-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user', 'status' => 'active',
        ]);
        $this->cafe = $this->user->cafes()->create(['name' => 'Quán trả tiền', 'status' => 'open']);

        $this->goi = Package::create([
            'name' => 'Pro Max', 'type' => 'promax', 'level' => 2,
            'status' => 'active', 'is_trial' => false, 'can_use_ai' => true,
        ]);
        $this->thoiHan = TimeSubscription::create([
            'package_id' => (string) $this->goi->id, 'name' => '1 tháng',
            'duration_value' => 1, 'duration_unit' => 'month', 'price' => 199_000, 'status' => 'active',
        ]);
    }

    // --- Dựng dữ liệu -------------------------------------------------------------

    /** Một gói đang chạy còn hạn tới `$conLai` ngày nữa. */
    private function goiDangChay(int $conLai = 10): Subscription
    {
        return Subscription::create([
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $this->goi->id,
            'time_subscription_id' => (string) $this->thoiHan->id,
            'package_name_snapshot' => 'Pro Max',
            'start_date' => now()->subDays(20),
            'end_date' => now()->addDays($conLai),
            'total_amount' => 218_900,
            'status' => 'active',
        ]);
    }

    /** Đơn gia hạn đang chờ cổng xác nhận — đúng như SubscriptionController tạo ra. */
    private function donGiaHan(Subscription $sub, string $cong = 'vnpay', string $ma = 'TXN-TEST-0001'): PackagePayment
    {
        return $sub->packagePayments()->create([
            'user_id' => (string) $this->user->id,
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $this->goi->id,
            'time_subscription_id' => (string) $this->thoiHan->id,
            'subtotal' => 199_000, 'vat_rate' => 10, 'vat_amount' => 19_900, 'amount' => 218_900,
            'payment_method' => $cong,
            'payment_status' => 'pending',
            'transaction_code' => $ma,
            'gateway_order_id' => $ma,
            'action_type' => 'renew',
            'previous_subscription_id' => (string) $sub->id,
            'previous_end_date' => $sub->end_date,
            'credit_amount' => 0,
        ]);
    }

    /** Bộ tham số VNPay kèm chữ ký ĐÚNG. */
    private function vnpayDaKy(array $doiLai = []): array
    {
        $data = array_merge([
            'vnp_Amount' => '21890000', 'vnp_BankCode' => 'NCB', 'vnp_ResponseCode' => '00',
            'vnp_TransactionNo' => '14212345', 'vnp_TxnRef' => 'TXN-TEST-0001',
        ], $doiLai);

        ksort($data);
        $parts = [];
        foreach ($data as $k => $v) {
            $parts[] = urlencode((string) $k) . '=' . urlencode((string) $v);
        }
        $data['vnp_SecureHash'] = hash_hmac('sha512', implode('&', $parts), self::VNPAY_SECRET);

        return $data;
    }

    /** Bộ tham số MoMo kèm chữ ký ĐÚNG. */
    private function momoDaKy(array $doiLai = []): array
    {
        $d = array_merge([
            'partnerCode' => 'MOMOTEST', 'orderId' => 'TXN-TEST-0001',
            'requestId' => 'TXN-TEST-0001-20260812120000', 'amount' => '218900',
            'orderInfo' => 'FunCafe goi Pro Max', 'orderType' => 'momo_wallet',
            'transId' => '2649123456', 'resultCode' => '0', 'message' => 'Successful.',
            'payType' => 'qr', 'responseTime' => '1755000000000', 'extraData' => '',
        ], $doiLai);

        $raw = 'accessKey=' . self::MOMO_ACCESS . '&amount=' . $d['amount'] . '&extraData=' . $d['extraData']
            . '&message=' . $d['message'] . '&orderId=' . $d['orderId'] . '&orderInfo=' . $d['orderInfo']
            . '&orderType=' . $d['orderType'] . '&partnerCode=' . $d['partnerCode'] . '&payType=' . $d['payType']
            . '&requestId=' . $d['requestId'] . '&responseTime=' . $d['responseTime']
            . '&resultCode=' . $d['resultCode'] . '&transId=' . $d['transId'];
        $d['signature'] = hash_hmac('sha256', $raw, self::MOMO_SECRET);

        return $d;
    }

    // === 6.3.2 — tự gõ đường dẫn "thành công" ======================================

    public function test_vnpay_tu_go_duong_dan_thanh_cong_khong_duoc_cap_goi(): void
    {
        $sub = $this->goiDangChay();
        $don = $this->donGiaHan($sub);
        $hanCu = $sub->end_date;

        // Không có chữ ký — đúng những gì gõ được bằng tay trên thanh địa chỉ.
        $this->get('/api/payments/vnpay/return?' . http_build_query([
            'vnp_TxnRef' => 'TXN-TEST-0001', 'vnp_ResponseCode' => '00', 'vnp_Amount' => '21890000',
        ]))->assertRedirectContains('code=invalid_signature');

        $this->assertSame('pending', $don->fresh()->payment_status, 'Đơn bị chuyển sang đã trả tiền.');
        $this->assertEquals(
            $hanCu->timestamp,
            $sub->fresh()->end_date->timestamp,
            'Gói được cộng hạn dù không ai trả tiền.',
        );
    }

    public function test_vnpay_sua_so_tien_tren_thanh_dia_chi_bi_tu_choi(): void
    {
        $sub = $this->goiDangChay();
        $don = $this->donGiaHan($sub);

        // Lấy chữ ký hợp lệ rồi hạ số tiền xuống 1.000đ.
        $q = $this->vnpayDaKy();
        $q['vnp_Amount'] = '100000';

        $this->get('/api/payments/vnpay/return?' . http_build_query($q))
            ->assertRedirectContains('code=invalid_signature');
        $this->assertSame('pending', $don->fresh()->payment_status);
    }

    public function test_momo_tu_go_duong_dan_thanh_cong_khong_duoc_cap_goi(): void
    {
        $sub = $this->goiDangChay();
        $don = $this->donGiaHan($sub, 'momo');

        $this->get('/api/payments/momo/return?' . http_build_query([
            'orderId' => 'TXN-TEST-0001', 'resultCode' => '0', 'amount' => '218900',
        ]))->assertRedirectContains('code=invalid_signature');

        $this->assertSame('pending', $don->fresh()->payment_status);
    }

    // === 6.3.3 + 6.4.1 — gọi lại hai lần không cộng hạn hai lần ====================

    /**
     * Chỗ nguy hiểm nhất của cả mảng dòng tiền: VNPay gửi Return URL cho trình duyệt
     * VÀ IPN cho máy chủ trên cùng một giao dịch. Nếu cả hai cùng cộng hạn thì quán
     * được thêm một tháng mà chỉ trả tiền một tháng, và lần nâng cấp sau cấn trừ theo
     * con số sai.
     */
    public function test_vnpay_goi_return_hai_lan_chi_cong_han_mot_lan(): void
    {
        $sub = $this->goiDangChay(10);
        $don = $this->donGiaHan($sub);
        $hanCu = $sub->end_date->copy();

        $q = http_build_query($this->vnpayDaKy());

        $this->get('/api/payments/vnpay/return?' . $q)->assertRedirectContains('status=success');
        $hanSauLan1 = $sub->fresh()->end_date->copy();

        $this->get('/api/payments/vnpay/return?' . $q)->assertRedirectContains('status=success');
        $hanSauLan2 = $sub->fresh()->end_date;

        $this->assertSame(
            $hanCu->copy()->addMonth()->toDateString(),
            $hanSauLan1->toDateString(),
            'Lần một phải cộng đúng một tháng vào hạn cũ.',
        );
        $this->assertSame(
            $hanSauLan1->toDateString(),
            $hanSauLan2->toDateString(),
            'Lần hai cộng thêm hạn — quán được một tháng miễn phí.',
        );
        $this->assertEquals(218_900 + 218_900, (float) $sub->fresh()->total_amount,
            'total_amount phải cộng đúng MỘT lần số tiền của đơn này.');
    }

    /** Return URL chạy trước rồi IPN về sau — IPN phải nhận ra đơn đã chốt. */
    public function test_vnpay_ipn_ve_sau_return_khong_cong_han_them(): void
    {
        $sub = $this->goiDangChay(10);
        $this->donGiaHan($sub);
        $q = http_build_query($this->vnpayDaKy());

        $this->get('/api/payments/vnpay/return?' . $q);
        $hanSauReturn = $sub->fresh()->end_date->copy();

        $this->getJson('/api/payments/vnpay/ipn?' . $q)
            ->assertStatus(200)
            ->assertJsonPath('RspCode', '02')
            ->assertJsonPath('Message', 'Order already confirmed');

        $this->assertSame($hanSauReturn->toDateString(), $sub->fresh()->end_date->toDateString());
    }

    public function test_momo_goi_return_hai_lan_chi_cong_han_mot_lan(): void
    {
        $sub = $this->goiDangChay(10);
        $this->donGiaHan($sub, 'momo');
        $hanCu = $sub->end_date->copy();
        $q = http_build_query($this->momoDaKy());

        $this->get('/api/payments/momo/return?' . $q)->assertRedirectContains('status=success');
        $hanSauLan1 = $sub->fresh()->end_date->copy();
        $this->get('/api/payments/momo/return?' . $q)->assertRedirectContains('status=success');

        $this->assertSame($hanCu->copy()->addMonth()->toDateString(), $hanSauLan1->toDateString());
        $this->assertSame($hanSauLan1->toDateString(), $sub->fresh()->end_date->toDateString());
    }

    // === 6.4.3 — IPN của MoMo là POST kèm thân JSON ================================

    public function test_momo_ipn_nhan_post_json_va_kich_hoat_goi(): void
    {
        $sub = $this->goiDangChay(10);
        $don = $this->donGiaHan($sub, 'momo');
        $hanCu = $sub->end_date->copy();

        $this->postJson('/api/payments/momo/ipn', $this->momoDaKy())->assertStatus(204);

        $this->assertSame('paid', $don->fresh()->payment_status);
        $this->assertSame($hanCu->copy()->addMonth()->toDateString(), $sub->fresh()->end_date->toDateString());
    }

    /** Đường IPN của MoMo KHÔNG dùng chung với VNPay: gọi bằng GET phải không có route. */
    public function test_momo_ipn_khong_nhan_get(): void
    {
        $this->get('/api/payments/momo/ipn')->assertStatus(405);
    }

    public function test_momo_ipn_chu_ky_sai_thi_khong_kich_hoat(): void
    {
        $sub = $this->goiDangChay();
        $don = $this->donGiaHan($sub, 'momo');

        $body = $this->momoDaKy();
        $body['amount'] = '1000';   // sửa sau khi ký

        $this->postJson('/api/payments/momo/ipn', $body)->assertStatus(204);
        $this->assertSame('pending', $don->fresh()->payment_status);
    }

    /**
     * Số tiền khớp chữ ký nhưng KHÁC số tiền của đơn trong CSDL: cổng gửi nhầm, hoặc
     * ai đó ký lại bằng khóa lộ. Không được cấp gói.
     */
    public function test_momo_ipn_so_tien_khong_khop_don_thi_bo_qua(): void
    {
        $sub = $this->goiDangChay();
        $don = $this->donGiaHan($sub, 'momo');

        $this->postJson('/api/payments/momo/ipn', $this->momoDaKy(['amount' => '1000']))->assertStatus(204);
        $this->assertSame('pending', $don->fresh()->payment_status);
    }

    public function test_vnpay_ipn_so_tien_khong_khop_don_thi_tu_choi(): void
    {
        $sub = $this->goiDangChay();
        $don = $this->donGiaHan($sub);

        $this->getJson('/api/payments/vnpay/ipn?' . http_build_query($this->vnpayDaKy(['vnp_Amount' => '100000'])))
            ->assertJsonPath('RspCode', '04');
        $this->assertSame('pending', $don->fresh()->payment_status);
    }

    // === 6.3.4 — khách hủy trên cổng ==============================================

    public function test_khach_huy_tren_cong_thi_don_bi_tu_choi_va_han_giu_nguyen(): void
    {
        $sub = $this->goiDangChay(10);
        $don = $this->donGiaHan($sub);
        $hanCu = $sub->end_date->copy();

        // 24 = người dùng hủy giao dịch.
        $this->get('/api/payments/vnpay/return?' . http_build_query($this->vnpayDaKy(['vnp_ResponseCode' => '24'])))
            ->assertRedirectContains('status=fail')
            ->assertRedirectContains('code=24');

        $this->assertSame('rejected', $don->fresh()->payment_status);
        $this->assertSame($hanCu->toDateString(), $sub->fresh()->end_date->toDateString(),
            'Khách hủy mà gói vẫn được cộng hạn.');
        $this->assertSame('active', $sub->fresh()->status, 'Gói đang chạy bị hủy oan khi khách bỏ giao dịch gia hạn.');
    }

    /** Hủy rồi mà cổng gọi lại báo thành công: đây là quyết định dứt khoát, không đảo. */
    public function test_don_da_bi_tu_choi_thi_callback_thanh_cong_khong_kich_hoat(): void
    {
        $sub = $this->goiDangChay(10);
        $don = $this->donGiaHan($sub);
        $hanCu = $sub->end_date->copy();

        $this->get('/api/payments/vnpay/return?' . http_build_query($this->vnpayDaKy(['vnp_ResponseCode' => '24'])));
        $this->get('/api/payments/vnpay/return?' . http_build_query($this->vnpayDaKy()));

        $this->assertSame('rejected', $don->fresh()->payment_status);
        $this->assertSame($hanCu->toDateString(), $sub->fresh()->end_date->toDateString());
    }

    public function test_ma_giao_dich_khong_ton_tai_thi_bao_khong_tim_thay(): void
    {
        $this->get('/api/payments/vnpay/return?' . http_build_query($this->vnpayDaKy(['vnp_TxnRef' => 'TXN-KHONG-CO'])))
            ->assertRedirectContains('code=not_found');
    }

    // === 6.5.3 — kích hoạt xong ghi đủ chứng từ ====================================

    public function test_kich_hoat_xong_ghi_du_ma_giao_dich_cua_cong(): void
    {
        $sub = $this->goiDangChay();
        $don = $this->donGiaHan($sub);

        $this->get('/api/payments/vnpay/return?' . http_build_query($this->vnpayDaKy()));

        $daChot = $don->fresh();
        $this->assertSame('paid', $daChot->payment_status);
        $this->assertNotNull($daChot->paid_at, 'Thiếu mốc thời gian thu tiền.');
        $this->assertSame('14212345', (string) $daChot->gateway_txn_no, 'Thiếu mã giao dịch của cổng để đối soát.');
        $this->assertSame('NCB', (string) $daChot->gateway_bank_code);
        $this->assertEquals(19_900, (float) $daChot->vat_amount, 'Thiếu dòng thuế trên chứng từ.');
        $this->assertEquals(218_900, (float) $daChot->amount);
    }

    /**
     * 6.8.2: số tiền đối chiếu với cổng phải là số ĐÃ GỒM thuế, không phải giá niêm
     * yết. Lệch ở đây nghĩa là quán trả 199.000 nhưng sổ ghi 218.900 (hoặc ngược lại),
     * và sai lệch đó chỉ lộ ra khi đối soát với sao kê của cổng cuối tháng.
     */
    public function test_so_tien_doi_chieu_voi_cong_da_gom_thue(): void
    {
        $sub = $this->goiDangChay();
        $this->donGiaHan($sub);

        // Cổng gửi về giá NIÊM YẾT (199.000 x100) trong khi đơn ghi 218.900 -> lệch.
        $this->getJson('/api/payments/vnpay/ipn?' . http_build_query($this->vnpayDaKy(['vnp_Amount' => '19900000'])))
            ->assertJsonPath('RspCode', '04')
            ->assertJsonPath('Message', 'Invalid amount');

        // Đúng số đã gồm thuế: 218.900 x100.
        $this->getJson('/api/payments/vnpay/ipn?' . http_build_query($this->vnpayDaKy()))
            ->assertJsonPath('RspCode', '00');
    }
}
