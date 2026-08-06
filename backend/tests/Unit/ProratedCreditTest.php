<?php

namespace Tests\Unit;

use App\Http\Controllers\SubscriptionController;
use Carbon\Carbon;
use ReflectionClass;
use Tests\TestCase;

/**
 * Cấn trừ khi nâng cấp giữa kỳ = số tiền thật trừ vào hóa đơn của khách. Tính sai
 * là thu thừa hoặc thu thiếu, và không có cách nào phát hiện ngoài việc khách khiếu nại.
 *
 * Gọi thẳng phương thức private qua reflection: nó là hàm thuần (chỉ đọc
 * start_date / end_date / total_amount) nên không cần CSDL.
 */
class ProratedCreditTest extends TestCase
{
    private function credit(?Carbon $start, ?Carbon $end, $paid): float
    {
        $sub = new class($start, $end, $paid) {
            public function __construct(
                public $start_date,
                public $end_date,
                public $total_amount,
            ) {}
        };

        $controller = (new ReflectionClass(SubscriptionController::class))->newInstanceWithoutConstructor();
        $method = new \ReflectionMethod(SubscriptionController::class, 'calculateProratedCredit');
        $method->setAccessible(true);

        return $method->invoke($controller, $sub);
    }

    public function test_dung_nua_chu_ky_thi_can_tru_mot_nua(): void
    {
        Carbon::setTestNow('2026-08-07 12:00:00');

        // Chu kỳ 30 ngày, đã đi qua đúng 15 ngày -> còn lại một nửa.
        $credit = $this->credit(
            Carbon::parse('2026-07-23 12:00:00'),
            Carbon::parse('2026-08-22 12:00:00'),
            300_000,
        );

        $this->assertEqualsWithDelta(150_000, $credit, 1);

        Carbon::setTestNow();
    }

    public function test_goi_mien_phi_khong_can_tru_gi(): void
    {
        Carbon::setTestNow('2026-08-07 12:00:00');

        // Fun Free trả 0đ: dù còn hạn cũng không có gì để cấn trừ.
        $credit = $this->credit(
            Carbon::parse('2026-08-01 12:00:00'),
            Carbon::parse('2026-08-31 12:00:00'),
            0,
        );

        $this->assertSame(0.0, $credit);

        Carbon::setTestNow();
    }

    public function test_goi_da_het_han_khong_can_tru_gi(): void
    {
        Carbon::setTestNow('2026-08-07 12:00:00');

        $credit = $this->credit(
            Carbon::parse('2026-06-01 12:00:00'),
            Carbon::parse('2026-07-01 12:00:00'),   // đã qua
            300_000,
        );

        $this->assertSame(0.0, $credit);

        Carbon::setTestNow();
    }

    public function test_vua_mua_xong_thi_can_tru_gan_nhu_toan_bo(): void
    {
        Carbon::setTestNow('2026-08-07 12:00:00');

        $credit = $this->credit(
            Carbon::parse('2026-08-07 12:00:00'),   // bắt đầu ngay lúc này
            Carbon::parse('2026-09-06 12:00:00'),
            300_000,
        );

        $this->assertEqualsWithDelta(300_000, $credit, 1);

        Carbon::setTestNow();
    }

    public function test_thieu_ngay_thi_tra_0_chu_khong_no(): void
    {
        // Dữ liệu hỏng phải ra 0 (không cấn trừ) chứ không được ném lỗi giữa luồng mua gói.
        $this->assertSame(0.0, $this->credit(null, null, 300_000));
    }
}
