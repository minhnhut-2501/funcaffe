<?php

namespace Tests\Unit;

use App\Services\MomoService;
use Tests\TestCase;

/**
 * Chữ ký MoMo — cùng vai trò với chữ ký VNPay: thứ DUY NHẤT ngăn người dùng tự gõ
 * một URL "thanh toán thành công" rồi được cấp gói miễn phí.
 *
 * Việc 6.4.5 của kế hoạch: trước đây chỉ VNPay có bài kiểm thử chữ ký, MoMo thì
 * không — mà MoMo lại là cổng có chuỗi ký PHỨC TẠP HƠN (13 trường, thứ tự viết
 * cứng theo tài liệu, và chuỗi ký lúc trả kết quả KHÁC chuỗi ký lúc tạo đơn).
 * Dùng nhầm chuỗi của createPayment thì mọi callback đều bị coi là giả mạo, và lỗi
 * đó chỉ lộ ra khi có người thật trả tiền thật.
 *
 * Không cần CSDL: chỉ là băm HMAC trên tham số cấu hình.
 */
class MomoSignatureTest extends TestCase
{
    private const SECRET = 'TEST_MOMO_SECRET_XYZ789';
    private const ACCESS_KEY = 'TEST_ACCESS_KEY';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.momo', [
            'partner_code' => 'MOMOTEST',
            'access_key'   => self::ACCESS_KEY,
            'secret_key'   => self::SECRET,
            'endpoint'     => 'https://test-payment.momo.vn/v2/gateway/api/create',
            'redirect_url' => 'http://localhost:8000/api/payments/momo/return',
            'ipn_url'      => 'http://localhost:8000/api/payments/momo/ipn',
            'request_type' => 'captureWallet',
        ]);
    }

    /**
     * Dựng phản hồi kèm chữ ký ĐÚNG, giống hệt cách MoMo ký khi trả kết quả.
     * Thứ tự trường ở đây phải khớp từng chữ với MomoService::validateSignature().
     */
    private function daKy(array $doiLai = []): array
    {
        $data = array_merge([
            'partnerCode'  => 'MOMOTEST',
            'orderId'      => 'TXN-20260812-0001-a1b2c3',
            'requestId'    => 'TXN-20260812-0001-a1b2c3-20260812120000',
            'amount'       => '219000',
            'orderInfo'    => 'FunCafe goi Pro Max',
            'orderType'    => 'momo_wallet',
            'transId'      => '2649123456',
            'resultCode'   => '0',
            'message'      => 'Successful.',
            'payType'      => 'qr',
            'responseTime' => '1755000000000',
            'extraData'    => '',
        ], $doiLai);

        $raw = 'accessKey=' . self::ACCESS_KEY
            . '&amount=' . $data['amount']
            . '&extraData=' . $data['extraData']
            . '&message=' . $data['message']
            . '&orderId=' . $data['orderId']
            . '&orderInfo=' . $data['orderInfo']
            . '&orderType=' . $data['orderType']
            . '&partnerCode=' . $data['partnerCode']
            . '&payType=' . $data['payType']
            . '&requestId=' . $data['requestId']
            . '&responseTime=' . $data['responseTime']
            . '&resultCode=' . $data['resultCode']
            . '&transId=' . $data['transId'];

        $data['signature'] = hash_hmac('sha256', $raw, self::SECRET);

        return $data;
    }

    public function test_chap_nhan_chu_ky_dung(): void
    {
        $this->assertTrue((new MomoService())->validateSignature($this->daKy()));
    }

    public function test_tu_choi_khi_sua_so_tien(): void
    {
        // Kịch bản thật: sửa amount trên thanh địa chỉ để "trả" ít đi.
        $data = $this->daKy();
        $data['amount'] = '1000';

        $this->assertFalse((new MomoService())->validateSignature($data));
    }

    public function test_tu_choi_khi_sua_ma_ket_qua_thanh_thanh_cong(): void
    {
        // Đơn thất bại (resultCode 1006 = khách hủy) được sửa thành 0.
        $data = $this->daKy(['resultCode' => '1006']);
        $data['resultCode'] = '0';

        $this->assertFalse((new MomoService())->validateSignature($data));
    }

    public function test_tu_choi_khi_sua_ma_don(): void
    {
        // Lấy chữ ký hợp lệ của đơn mình rồi gắn sang mã đơn của người khác.
        $data = $this->daKy();
        $data['orderId'] = 'TXN-20260812-0002-z9y8x7';

        $this->assertFalse((new MomoService())->validateSignature($data));
    }

    public function test_tu_choi_khi_khong_co_chu_ky(): void
    {
        $data = $this->daKy();
        unset($data['signature']);

        $this->assertFalse((new MomoService())->validateSignature($data));
    }

    public function test_tu_choi_khi_may_chu_chua_cau_hinh_secret(): void
    {
        // Thiếu cấu hình phải là TỪ CHỐI, không phải "bỏ qua kiểm tra". Một lần deploy
        // quên biến môi trường mà bỏ qua kiểm tra là mở toang cổng thanh toán.
        $data = $this->daKy();
        config()->set('services.momo.secret_key', '');

        $this->assertFalse((new MomoService())->validateSignature($data));
    }

    /**
     * Chữ ký ký bằng khóa của MỘT máy chủ khác không dùng được ở đây. Nghe hiển
     * nhiên, nhưng đây chính là điều bảo vệ khi khóa thử nghiệm bị lộ trên GitHub:
     * đổi khóa thật là mọi chữ ký cũ hết giá trị.
     */
    public function test_chu_ky_ky_bang_khoa_khac_bi_tu_choi(): void
    {
        $data = $this->daKy();
        config()->set('services.momo.secret_key', 'KHOA_KHAC_HOAN_TOAN');

        $this->assertFalse((new MomoService())->validateSignature($data));
    }

    /** Chưa cấu hình đủ ba khóa thì coi như cổng chưa bật — không được đi tiếp. */
    public function test_chua_cau_hinh_du_thi_bao_la_chua_bat(): void
    {
        $momo = new MomoService();
        $this->assertTrue($momo->isConfigured());

        config()->set('services.momo.access_key', '');
        $this->assertFalse($momo->isConfigured());
    }
}
