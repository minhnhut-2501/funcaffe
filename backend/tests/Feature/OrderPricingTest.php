<?php

namespace Tests\Feature;

use App\Models\Cafe;
use App\Models\Category;
use App\Models\Item;
use App\Models\Order;
use App\Models\Package;
use App\Models\Subscription;
use App\Models\Topping;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Tính tiền đơn hàng — chỗ tiền thật đổi chủ mỗi ngày ở mỗi quán.
 *
 * Nguyên tắc gốc đang bảo vệ: BACKEND TỰ TÍNH GIÁ TỪ CSDL, không tin bất cứ con số
 * nào client gửi lên. Mất nguyên tắc này thì ai cũng sửa được giá bằng một request.
 */
class OrderPricingTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'cafes', 'packages', 'subscriptions', 'categories',
        'items', 'item_prices', 'toppings', 'tables', 'orders',
        'order_details', 'order_detail_toppings',
    ];

    private User $user;
    private Cafe $cafe;
    private Item $item;
    private Topping $topping;
    private $table;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Chủ quán kiểm thử',
            'email' => 'pos-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);

        $this->cafe = $this->user->cafes()->create(['name' => 'Quán kiểm thử', 'status' => 'open']);

        $package = Package::create([
            'name' => 'Pro Max', 'type' => 'promax', 'level' => 2,
            'status' => 'active', 'is_trial' => false, 'can_use_ai' => true,
        ]);

        // Bán hàng đi qua middleware 'subscription' nên quán phải có gói còn hiệu lực.
        Subscription::create([
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $package->id,
            'package_name_snapshot' => $package->name,
            'start_date' => now()->subDay(),
            'end_date' => now()->addMonth(),
            'total_amount' => 199_000,
            'status' => 'active',
        ]);

        $category = Category::create([
            'cafe_id' => (string) $this->cafe->id, 'name' => 'Cà phê', 'is_active' => true,
        ]);

        $this->item = Item::create([
            'cafe_id' => (string) $this->cafe->id,
            'category_id' => (string) $category->id,
            'name' => 'Cà phê sữa',
            'base_price' => 30_000,
            'is_available' => true,
            'allow_topping' => true,
        ]);

        $this->topping = Topping::create([
            'cafe_id' => (string) $this->cafe->id,
            'name' => 'Trân châu',
            'price' => 5_000,
            'is_available' => true,
        ]);

        $this->table = $this->cafe->tables()->create([
            'name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty',
        ]);

        Sanctum::actingAs($this->user);
    }

    private function createOrder(array $items): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/cafes/{$this->cafe->id}/orders", [
            'table_id' => (string) $this->table->id,
            'items' => $items,
        ]);
    }

    private function oneItem(array $overrides = []): array
    {
        return array_merge([
            'item_id' => (string) $this->item->id,
            'item_name_snapshot' => 'Cà phê sữa',
            'quantity' => 2,
        ], $overrides);
    }

    public function test_gia_lay_tu_csdl_chu_khong_lay_tu_client(): void
    {
        // Client cố gửi giá 1.000đ và tên món khác. Cả hai phải bị bỏ qua.
        $res = $this->createOrder([$this->oneItem([
            'item_name_snapshot' => 'Món giá rẻ',
            'unit_price' => 1_000,
            'subtotal' => 2_000,
        ])]);

        $res->assertStatus(201);
        // 30.000 x 2 = 60.000, không phải 2.000
        $this->assertSame(60_000.0, (float) $res->json('subtotal'));
        $this->assertSame('Cà phê sữa', $res->json('order_details.0.item_name_snapshot'));
    }

    public function test_topping_nhan_theo_ca_so_luong_topping_lan_so_luong_mon(): void
    {
        // 2 ly, mỗi ly 2 phần trân châu: 30.000x2 + 5.000x2x2 = 80.000
        $res = $this->createOrder([$this->oneItem([
            'toppings' => [[
                'topping_id' => (string) $this->topping->id,
                'quantity' => 2,
            ]],
        ])]);

        $res->assertStatus(201);
        $this->assertSame(80_000.0, (float) $res->json('subtotal'));
    }

    public function test_khong_ban_duoc_mon_da_an(): void
    {
        // Giỏ hàng được giữ lại phía server, nên món có thể bị ẩn giữa lúc bỏ vào giỏ
        // và lúc chốt đơn.
        $this->item->update(['is_available' => false]);

        $this->createOrder([$this->oneItem()])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Món "Cà phê sữa" đã ngừng bán, vui lòng bỏ khỏi đơn.');
    }

    public function test_khong_dung_duoc_mon_cua_quan_khac(): void
    {
        $khac = $this->user->cafes()->create(['name' => 'Quán khác', 'status' => 'open']);
        $monCuaQuanKhac = Item::create([
            'cafe_id' => (string) $khac->id,
            'name' => 'Món quán khác', 'base_price' => 1_000, 'is_available' => true,
        ]);

        $this->createOrder([$this->oneItem(['item_id' => (string) $monCuaQuanKhac->id])])
            ->assertStatus(422);
    }

    public function test_giam_gia_khong_the_vuot_tam_tinh(): void
    {
        $orderId = $this->createOrder([$this->oneItem()])->json('id');

        // Tạm tính 60.000, xin giảm 999.000 -> phải bị kẹp về 60.000, tổng = 0 (không âm).
        $res = $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$orderId}/pay", [
            'payment_method' => 'cash',
            'discount_amount' => 999_000,
            'cash_received' => 0,
        ]);

        $res->assertStatus(200);
        $this->assertSame(60_000.0, (float) $res->json('discount_amount'));
        $this->assertSame(0.0, (float) $res->json('total_amount'));
    }

    public function test_khach_dua_thieu_tien_thi_khong_thanh_toan_duoc(): void
    {
        $orderId = $this->createOrder([$this->oneItem()])->json('id');

        $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$orderId}/pay", [
            'payment_method' => 'cash',
            'cash_received' => 50_000,   // cần 60.000
        ])->assertStatus(422);
    }

    /**
     * BỎ TRỐNG ô tiền khách đưa cũng phải bị chặn, không chỉ đưa thiếu.
     *
     * Đây từng là lỗ thật: `cash_received` là `nullable`, mà cái chốt "đưa thiếu thì
     * không cho thanh toán" lại nằm bên trong `isset()`. Không gửi trường đó là đi
     * lọt — đơn chốt bình thường với `cash_received` và `change_amount` cùng null,
     * biên lai in ra không có tiền thối để đối chiếu cuối ca.
     */
    public function test_tien_mat_ma_khong_ghi_so_khach_dua_thi_bi_tu_choi(): void
    {
        $orderId = $this->createOrder([$this->oneItem()])->json('id');

        $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$orderId}/pay", [
            'payment_method' => 'cash',
        ])->assertStatus(422)->assertJsonValidationErrors('cash_received');

        $this->assertSame('active', Order::find($orderId)->status, 'Đơn bị chốt dù lệnh đã bị từ chối.');
    }

    /** ĐỐI CHỨNG: chuyển khoản thì không có tiền khách đưa, và đó là bình thường. */
    public function test_chuyen_khoan_khong_can_so_tien_khach_dua(): void
    {
        $orderId = $this->createOrder([$this->oneItem()])->json('id');

        $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$orderId}/pay", [
            'payment_method' => 'vietqr',
        ])->assertStatus(200);
    }

    public function test_thanh_toan_tra_ve_tien_thoi_dung(): void
    {
        $orderId = $this->createOrder([$this->oneItem()])->json('id');

        $res = $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$orderId}/pay", [
            'payment_method' => 'cash',
            'cash_received' => 100_000,
        ]);

        $res->assertStatus(200);
        $this->assertSame(40_000, (int) $res->json('change_amount'));
        // Thanh toán xong bàn phải về trống.
        $this->assertSame('empty', $this->table->fresh()->status);
    }

    /**
     * `slim=1` bỏ dòng món khỏi danh sách, nhưng KHÔNG được bỏ thứ bảng Hóa đơn cần.
     *
     * Bảng đó hiện mã phiếu, mã order, tên bàn, tổng tiền, phương thức, giờ — mất bất
     * kỳ trường nào trong số đó là cả cột trắng bóc. Riêng `table` phải giữ eager-load
     * vì tên bàn nằm ở quan hệ, không nằm trên chính đơn.
     */
    public function test_danh_sach_gon_bo_dong_mon_nhung_giu_du_thu_bang_can(): void
    {
        $orderId = $this->createOrder([$this->oneItem()])->json('id');
        $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$orderId}/pay", [
            'payment_method' => 'cash', 'cash_received' => 100_000,
        ])->assertStatus(200);

        $gon = $this->getJson("/api/cafes/{$this->cafe->id}/orders?status=paid&slim=1")
            ->assertStatus(200)->json();

        $this->assertCount(1, $gon);
        $this->assertEmpty($gon[0]['order_details'] ?? [], 'Bản gọn vẫn kèm dòng món.');
        foreach (['invoice_code', 'code', 'total_amount', 'payment_method', 'paid_at'] as $truong) {
            $this->assertNotNull($gon[0][$truong] ?? null, "Bản gọn thiếu trường `{$truong}` mà bảng Hóa đơn đang hiện.");
        }
        $this->assertSame($this->table->name, $gon[0]['table']['name'] ?? null, 'Bản gọn mất tên bàn.');
    }

    /**
     * ĐỐI CHỨNG. Không có bài này thì bài trên vẫn xanh ngay cả khi dòng món biến mất
     * khỏi MỌI phản hồi — lúc đó hộp thoại chi tiết và bản in đều rỗng mà không ai hay.
     */
    public function test_khong_co_co_gon_thi_van_tra_du_dong_mon(): void
    {
        $orderId = $this->createOrder([$this->oneItem()])->json('id');
        $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$orderId}/pay", [
            'payment_method' => 'cash', 'cash_received' => 100_000,
        ])->assertStatus(200);

        $day = $this->getJson("/api/cafes/{$this->cafe->id}/orders?status=paid")
            ->assertStatus(200)->json();

        $this->assertNotEmpty($day[0]['order_details'] ?? [], 'Danh sách đầy đủ lại không có dòng món.');

        // Và đường `show` — nơi hộp thoại chi tiết đi lấy món — luôn phải đủ.
        $this->assertNotEmpty(
            $this->getJson("/api/cafes/{$this->cafe->id}/orders/{$orderId}")->assertStatus(200)->json('order_details'),
            'Xem một hóa đơn mà không có dòng món thì bản in ra tờ phiếu trống.',
        );
    }

    public function test_don_da_thanh_toan_khong_thanh_toan_lai_duoc(): void
    {
        $orderId = $this->createOrder([$this->oneItem()])->json('id');
        $url = "/api/cafes/{$this->cafe->id}/orders/{$orderId}/pay";

        $this->postJson($url, ['payment_method' => 'cash', 'cash_received' => 100_000])->assertStatus(200);
        $this->postJson($url, ['payment_method' => 'cash', 'cash_received' => 100_000])->assertStatus(400);
    }
}
