<?php

namespace Tests\Feature;

use App\Models\Cafe;
use App\Models\Order;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Doanh thu phải được xếp vào NGÀY VIỆT NAM, không phải ngày UTC.
 *
 * Vì sao cần một tệp riêng cho đúng một câu hỏi: máy chủ đọc `paid_at` ra khỏi Mongo
 * dưới dạng UTCDateTime rồi tự dựng lại đối tượng ngày (xem `toCarbon`). Nếu đối
 * tượng đó giữ múi giờ UTC thì `format('Y-m-d')` cắt theo UTC, trong khi trình duyệt
 * cắt theo giờ địa phương bằng `ngayDiaPhuong()`. Hai bên lệch nhau đúng 7 tiếng.
 *
 * Hậu quả không lộ ra ở giữa ngày — chỉ những đơn thu từ 00:00 đến 07:00 giờ Việt Nam
 * mới rơi sang ô của hôm trước. Thẻ "Hôm nay" ở trang Quản lý quán và cột biểu đồ ở
 * trang Doanh thu vì thế cãi nhau vào mỗi buổi sáng sớm, rồi tự khớp lại lúc 7 giờ,
 * và không chỗ nào báo lỗi.
 *
 * Bài này phải ĐỎ nếu ai đó bỏ mất phép đổi múi giờ. Nó là chốt chặn cho mọi phép
 * cộng doanh thu chuyển xuống máy chủ về sau.
 */
class RevenueTimezoneTest extends MongoTestCase
{
    protected array $collections = ['users', 'cafes', 'orders', 'subscriptions', 'packages'];

    private User $user;
    private Cafe $cafe;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Chủ quán múi giờ',
            'email' => 'tz-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $this->cafe = $this->user->cafes()->create(['name' => 'Quán múi giờ', 'status' => 'open']);

        Sanctum::actingAs($this->user);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Một đơn đã thu tiền vào đúng mốc thời gian cho trước. */
    private function donDaThu(string $utc, int $tien): void
    {
        Order::create([
            'cafe_id' => (string) $this->cafe->id,
            'code' => 'DH-' . uniqid(),
            'invoice_code' => 'HD-' . uniqid(),
            'status' => 'paid',
            'payment_status' => 'paid',
            'payment_method' => 'cash',
            'subtotal' => $tien,
            'discount_amount' => 0,
            'total_amount' => $tien,
            'paid_at' => Carbon::parse($utc, 'UTC'),
            'created_at' => Carbon::parse($utc, 'UTC'),
        ]);
    }

    /**
     * Đơn thu lúc 00:30 SÁNG giờ Việt Nam = 17:30 hôm trước theo giờ UTC.
     * Cắt theo UTC thì nó rơi vào hôm qua và thẻ "Hôm nay" hiện 0 đ.
     */
    public function test_don_thu_luc_rang_sang_van_thuoc_ve_hom_nay(): void
    {
        // "Bây giờ" là 08:00 sáng ngày 11/08 giờ Việt Nam.
        Carbon::setTestNow(Carbon::parse('2026-08-11 08:00:00', 'Asia/Ho_Chi_Minh'));

        // 00:30 ngày 11/08 giờ VN — cùng ngày, nhưng là 17:30 ngày 10/08 theo UTC.
        $this->donDaThu('2026-08-10 17:30:00', 500_000);

        $res = $this->getJson('/api/revenue/overview');
        $res->assertOk();

        $this->assertSame(
            500_000,
            $res->json('today'),
            'Đơn thu lúc 00:30 giờ VN phải tính vào doanh thu HÔM NAY. Ra 0 nghĩa là máy chủ đang cắt ngày theo giờ UTC.',
        );
    }

    /**
     * Cùng một cái bẫy nhưng ở mốc THÁNG, nơi nó khó thấy hơn nhiều: đơn thu lúc
     * 00:30 ngày 01/08 giờ VN, cắt theo UTC là 31/07 — doanh thu tháng 8 chảy ngược
     * về tháng 7 và cả hai tháng cùng sai.
     */
    public function test_don_dau_thang_khong_chay_nguoc_ve_thang_truoc(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-11 08:00:00', 'Asia/Ho_Chi_Minh'));

        // 00:30 ngày 01/08 giờ VN = 17:30 ngày 31/07 theo UTC.
        $this->donDaThu('2026-07-31 17:30:00', 300_000);

        $res = $this->getJson('/api/revenue/overview');
        $res->assertOk();

        $this->assertSame(
            300_000,
            $res->json('this_month'),
            'Đơn thu lúc 00:30 ngày 01/08 giờ VN thuộc THÁNG 8. Ra 0 nghĩa là đang cắt tháng theo giờ UTC.',
        );

        $theoThang = $res->json('revenue_by_month');
        $this->assertArrayHasKey('2026-08', $theoThang, 'Biểu đồ theo tháng phải có mốc 2026-08.');
        $this->assertArrayNotHasKey('2026-07', $theoThang, 'Không được sinh ra mốc 2026-07 từ một đơn của tháng 8.');
    }

    /**
     * Đơn thu lúc 23:30 giờ VN ngày HÔM QUA = 16:30 UTC hôm qua — cả hai múi giờ đều
     * ra hôm qua. Bài này giữ cho bản vá không đi quá tay theo chiều ngược lại.
     */
    public function test_don_toi_hom_qua_khong_bi_keo_sang_hom_nay(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-11 08:00:00', 'Asia/Ho_Chi_Minh'));

        // 23:30 ngày 10/08 giờ VN = 16:30 ngày 10/08 theo UTC.
        $this->donDaThu('2026-08-10 16:30:00', 700_000);

        $res = $this->getJson('/api/revenue/overview');
        $res->assertOk();

        $this->assertSame(0, $res->json('today'), 'Đơn của tối hôm qua không được tính vào hôm nay.');
        $this->assertSame(700_000, $res->json('total'), 'Nhưng vẫn phải nằm trong tổng doanh thu.');
    }
}
