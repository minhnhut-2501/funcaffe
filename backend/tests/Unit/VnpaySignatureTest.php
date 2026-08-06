<?php

namespace Tests\Unit;

use App\Services\VnpayService;
use Tests\TestCase;

/**
 * Chữ ký VNPay là thứ DUY NHẤT ngăn người dùng tự gõ một URL "thanh toán thành
 * công" rồi được cấp gói miễn phí. Toàn bộ luồng tiền ở PaymentGatewayController
 * đứng sau đúng một câu `if (!$this->vnpay->validateSignature(...))`.
 *
 * Không cần CSDL: chỉ là băm HMAC trên tham số cấu hình.
 */
class VnpaySignatureTest extends TestCase
{
    private const SECRET = 'TEST_HASH_SECRET_ABC123';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.vnpay', [
            'tmn_code'   => 'TESTTMN',
            'hash_secret' => self::SECRET,
            'url'        => 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
            'return_url' => 'http://localhost:8000/api/payments/vnpay/return',
        ]);
    }

    /** Dựng bộ tham số phản hồi kèm chữ ký ĐÚNG, giống cổng trả về. */
    private function signedResponse(array $overrides = []): array
    {
        $data = array_merge([
            'vnp_Amount'        => '19900000',
            'vnp_BankCode'      => 'NCB',
            'vnp_ResponseCode'  => '00',
            'vnp_TransactionNo' => '14212345',
            'vnp_TxnRef'        => 'TXN-20260807-0001',
        ], $overrides);

        ksort($data);
        $parts = [];
        foreach ($data as $k => $v) {
            $parts[] = urlencode((string) $k) . '=' . urlencode((string) $v);
        }
        $data['vnp_SecureHash'] = hash_hmac('sha512', implode('&', $parts), self::SECRET);

        return $data;
    }

    public function test_chap_nhan_chu_ky_dung(): void
    {
        $this->assertTrue((new VnpayService())->validateSignature($this->signedResponse()));
    }

    public function test_tu_choi_khi_sua_so_tien(): void
    {
        // Kịch bản thật: người dùng sửa vnp_Amount trên thanh địa chỉ để "trả" ít đi.
        $query = $this->signedResponse();
        $query['vnp_Amount'] = '100';

        $this->assertFalse((new VnpayService())->validateSignature($query));
    }

    public function test_tu_choi_khi_sua_ma_ket_qua_thanh_cong(): void
    {
        // Đơn thất bại được sửa thành '00' để giả vờ đã thanh toán.
        $query = $this->signedResponse(['vnp_ResponseCode' => '24']);
        $query['vnp_ResponseCode'] = '00';

        $this->assertFalse((new VnpayService())->validateSignature($query));
    }

    public function test_tu_choi_khi_khong_co_chu_ky(): void
    {
        $query = $this->signedResponse();
        unset($query['vnp_SecureHash']);

        $this->assertFalse((new VnpayService())->validateSignature($query));
    }

    public function test_tu_choi_khi_server_chua_cau_hinh_secret(): void
    {
        // Quan trọng: thiếu cấu hình phải là TỪ CHỐI, không phải "bỏ qua kiểm tra".
        // Nếu để lọt thì một lần deploy quên biến môi trường là mở toang cổng thanh toán.
        $query = $this->signedResponse();
        config()->set('services.vnpay.hash_secret', '');

        $this->assertFalse((new VnpayService())->validateSignature($query));
    }
}
