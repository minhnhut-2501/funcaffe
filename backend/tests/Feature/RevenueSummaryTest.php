<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\Order;
use App\Models\OrderDetail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * `GET /api/revenue/summary` — phép cộng doanh thu đã dời hẳn xuống máy chủ.
 *
 * Trước đây trình duyệt tải toàn bộ hóa đơn của từng quán kèm dòng món rồi tự cộng.
 * Bài này khóa lại hợp đồng của endpoint thay thế: đúng phạm vi quán, đúng khoảng
 * ngày, đúng cách gom nhóm — vì từ nay không còn ai đối chiếu bằng mắt được nữa.
 *
 * Ba thứ dễ vỡ nhất và đều có bài riêng bên dưới:
 *  · lọc theo khoảng ngày (sai một đầu là lệch cả kỳ báo cáo),
 *  · phạm vi quán (rò rỉ số của quán người khác là lỗi nghiêm trọng nhất ở đây),
 *  · quán không có doanh thu vẫn phải có mặt trong danh sách, để bảng so sánh bên
 *    trình duyệt phân biệt được "chưa bán được gì" với "tải hỏng".
 */
class RevenueSummaryTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'shops', 'orders', 'order_details', 'subscriptions', 'packages',
    ];

    private User $user;
    private Shop $quanA;
    private Shop $quanB;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-08-20 10:00:00', 'Asia/Ho_Chi_Minh'));

        $this->user = User::create([
            'full_name' => 'Chủ hai quán',
            'email' => 'sum-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $this->quanA = $this->user->shops()->create(['name' => 'Quán A', 'status' => 'open']);
        $this->quanB = $this->user->shops()->create(['name' => 'Quán B', 'status' => 'open']);

        Sanctum::actingAs($this->user);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function donDaThu(Shop $shop, string $ngayGio, int $tien, ?string $ten = null, int $sl = 1): Order
    {
        $order = Order::create([
            'shop_id' => (string) $shop->id,
            'code' => 'DH-' . uniqid(),
            'invoice_code' => 'HD-' . uniqid(),
            'status' => 'paid',
            'payment_status' => 'paid',
            'payment_method' => 'cash',
            'subtotal' => $tien,
            'discount_amount' => 0,
            'total_amount' => $tien,
            'paid_at' => Carbon::parse($ngayGio, 'Asia/Ho_Chi_Minh'),
            'created_at' => Carbon::parse($ngayGio, 'Asia/Ho_Chi_Minh'),
        ]);

        if ($ten !== null) {
            OrderDetail::create([
                'order_id' => (string) $order->id,
                'product_name_snapshot' => $ten,
                'quantity' => $sl,
                'unit_price' => (int) ($tien / max(1, $sl)),
                'total_price' => $tien,
            ]);
        }

        return $order;
    }

    public function test_gop_moi_quan_khi_khong_chi_dinh_quan(): void
    {
        $this->donDaThu($this->quanA, '2026-08-10 09:00:00', 100_000);
        $this->donDaThu($this->quanB, '2026-08-10 09:00:00', 250_000);

        $res = $this->getJson('/api/revenue/summary');
        $res->assertOk();

        $this->assertSame(350_000, $res->json('total'));
        $this->assertSame(2, $res->json('count'));
        $this->assertCount(2, $res->json('shops'));
    }

    public function test_chi_dinh_mot_quan_thi_khong_lan_sang_quan_khac(): void
    {
        $this->donDaThu($this->quanA, '2026-08-10 09:00:00', 100_000);
        $this->donDaThu($this->quanB, '2026-08-10 09:00:00', 250_000);

        $res = $this->getJson('/api/revenue/summary?shop_id=' . $this->quanA->id);
        $res->assertOk();

        $this->assertSame(100_000, $res->json('total'));
        $this->assertCount(1, $res->json('shops'));
        $this->assertSame('Quán A', $res->json('shops.0.shop_name'));
    }

    public function test_khoang_ngay_lay_tron_hai_dau(): void
    {
        // Ngoài khoảng ở đầu dưới.
        $this->donDaThu($this->quanA, '2026-08-09 23:30:00', 999_000);
        // Sát mép đầu dưới — phải LẤY.
        $this->donDaThu($this->quanA, '2026-08-10 00:05:00', 100_000);
        // Sát mép đầu trên — phải LẤY.
        $this->donDaThu($this->quanA, '2026-08-12 23:55:00', 200_000);
        // Ngoài khoảng ở đầu trên.
        $this->donDaThu($this->quanA, '2026-08-13 00:10:00', 888_000);

        $res = $this->getJson('/api/revenue/summary?from=2026-08-10&to=2026-08-12');
        $res->assertOk();

        $this->assertSame(300_000, $res->json('total'), 'Khoảng lọc phải lấy trọn cả ngày đầu lẫn ngày cuối.');
        $this->assertSame(2, $res->json('count'));
    }

    public function test_gom_nhom_theo_ngay_va_theo_thang(): void
    {
        $this->donDaThu($this->quanA, '2026-08-10 09:00:00', 100_000);
        $this->donDaThu($this->quanA, '2026-08-10 15:00:00', 50_000);
        $this->donDaThu($this->quanA, '2026-08-11 09:00:00', 70_000);

        $res = $this->getJson('/api/revenue/summary');
        $res->assertOk();

        $this->assertSame(150_000, $res->json('by_day.2026-08-10'), 'Hai đơn cùng ngày phải cộng vào một mốc.');
        $this->assertSame(70_000, $res->json('by_day.2026-08-11'));
        $this->assertSame(220_000, $res->json('by_month.2026-08'));
    }

    public function test_top_mon_xep_theo_doanh_thu(): void
    {
        $this->donDaThu($this->quanA, '2026-08-10 09:00:00', 60_000, 'Cà phê sữa', 2);
        $this->donDaThu($this->quanA, '2026-08-10 10:00:00', 30_000, 'Cà phê sữa', 1);
        $this->donDaThu($this->quanA, '2026-08-10 11:00:00', 200_000, 'Trà đào', 4);

        $res = $this->getJson('/api/revenue/summary');
        $res->assertOk();

        $this->assertSame('Trà đào', $res->json('top_items.0.name'), 'Món doanh thu cao nhất phải đứng đầu.');
        $this->assertSame(200_000, $res->json('top_items.0.revenue'));
        $this->assertSame('Cà phê sữa', $res->json('top_items.1.name'));
        $this->assertSame(90_000, $res->json('top_items.1.revenue'), 'Hai đơn cùng món phải gộp lại.');
        $this->assertSame(3, $res->json('top_items.1.count'));
    }

    public function test_quan_khong_co_doanh_thu_van_co_mat_trong_danh_sach(): void
    {
        $this->donDaThu($this->quanA, '2026-08-10 09:00:00', 100_000);

        $res = $this->getJson('/api/revenue/summary');
        $res->assertOk();

        $rows = collect($res->json('shops'))->keyBy('shop_name');
        $this->assertArrayHasKey('Quán B', $rows->all(), 'Quán chưa bán được gì vẫn phải có hàng, với số 0.');
        $this->assertSame(0, $rows['Quán B']['total']);
        $this->assertSame(0, $rows['Quán B']['count']);
    }

    public function test_don_chua_thanh_toan_khong_duoc_tinh(): void
    {
        $this->donDaThu($this->quanA, '2026-08-10 09:00:00', 100_000);
        Order::create([
            'shop_id' => (string) $this->quanA->id,
            'code' => 'DH-treo-' . uniqid(),
            'status' => 'active',
            'payment_status' => 'unpaid',
            'subtotal' => 500_000,
            'discount_amount' => 0,
            'total_amount' => 500_000,
            'created_at' => Carbon::parse('2026-08-10 09:00:00', 'Asia/Ho_Chi_Minh'),
        ]);

        $res = $this->getJson('/api/revenue/summary');
        $res->assertOk();

        $this->assertSame(100_000, $res->json('total'), 'Đơn đang phục vụ chưa phải doanh thu.');
    }

    public function test_khong_doc_duoc_quan_cua_nguoi_khac(): void
    {
        $nguoiLa = User::create([
            'full_name' => 'Người lạ',
            'email' => 'la-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $quanLa = $nguoiLa->shops()->create(['name' => 'Quán lạ', 'status' => 'open']);
        $this->donDaThu($quanLa, '2026-08-10 09:00:00', 777_000);

        $res = $this->getJson('/api/revenue/summary?shop_id=' . $quanLa->id);
        $res->assertNotFound();

        // Và không được lọt vào đường gộp mọi quán.
        $gop = $this->getJson('/api/revenue/summary');
        $gop->assertOk();
        $this->assertSame(0, $gop->json('total'));
    }
}
