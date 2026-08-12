<?php

namespace Tests\Feature;

use App\Models\Cafe;
use App\Models\Category;
use App\Models\Item;
use App\Models\Package;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Ba trạng thái quán và quán mới chưa có gói (4.1.1 + 4.1.3).
 *
 * Trước đây ba trạng thái chỉ là ba cái nhãn màu trên trang Thông tin quán: chọn
 * "Ngừng hoạt động" xong vẫn bán hàng bình thường. Bài kiểm thử này giữ ý nghĩa vừa
 * chốt cho từng trạng thái — xem chú thích ở ChecksCafeStatus.
 */
class CafeStatusTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'cafes', 'packages', 'subscriptions', 'categories',
        'items', 'item_prices', 'toppings', 'tables', 'orders',
        'order_details', 'order_detail_toppings',
    ];

    private User $user;
    private Cafe $cafe;
    private Item $item;
    private $table;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Chủ quán trạng thái',
            'email' => 'status-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $this->cafe = $this->user->cafes()->create(['name' => 'Quán trạng thái', 'status' => 'open']);

        $this->capGoi($this->cafe);

        $category = Category::create([
            'cafe_id' => (string) $this->cafe->id, 'name' => 'Cà phê', 'is_active' => true,
        ]);
        $this->item = Item::create([
            'cafe_id' => (string) $this->cafe->id,
            'category_id' => (string) $category->id,
            'name' => 'Cà phê sữa', 'base_price' => 30_000, 'is_available' => true,
        ]);
        $this->table = $this->cafe->tables()->create(['name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty']);

        Sanctum::actingAs($this->user);
    }

    private function capGoi(Cafe $cafe): void
    {
        $package = Package::firstOrCreate(
            ['type' => 'promax'],
            ['name' => 'Pro Max', 'level' => 2, 'status' => 'active', 'is_trial' => false, 'can_use_ai' => true],
        );
        Subscription::create([
            'cafe_id' => (string) $cafe->id,
            'package_id' => (string) $package->id,
            'package_name_snapshot' => $package->name,
            'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
            'total_amount' => 199_000, 'status' => 'active',
        ]);
    }

    private function moDon(): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/cafes/{$this->cafe->id}/orders", [
            'table_id' => (string) $this->table->id,
            'items' => [['item_id' => (string) $this->item->id, 'item_name_snapshot' => 'Cà phê sữa', 'quantity' => 1]],
        ]);
    }

    // --- 4.1.3 Đang mở cửa --------------------------------------------------------

    public function test_quan_dang_mo_thi_ban_hang_binh_thuong(): void
    {
        $this->moDon()->assertStatus(201);
    }

    // --- 4.1.3 Đã đóng cửa ---------------------------------------------------------

    public function test_quan_da_dong_cua_thi_khong_mo_don_moi(): void
    {
        $this->cafe->update(['status' => 'closed']);

        $this->moDon()
            ->assertStatus(422)
            ->assertJsonPath('message', 'Quán đang ở trạng thái "Đã đóng cửa" nên không mở đơn mới được. Đổi sang "Đang mở" ở trang Thông tin quán để bán tiếp.');
    }

    /**
     * Điều quan trọng nhất của trạng thái "đã đóng cửa": bàn đang ngồi PHẢI chốt được
     * tiền. Chặn cả đường thanh toán là nhốt tiền của khách trong một cái bàn không ai
     * đóng được.
     */
    public function test_quan_dong_cua_van_thanh_toan_duoc_ban_dang_ngoi(): void
    {
        $donId = $this->moDon()->json('id');
        $this->cafe->update(['status' => 'closed']);

        $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$donId}/pay", ['payment_method' => 'cash'])
            ->assertStatus(200);
    }

    public function test_quan_dong_cua_van_them_duoc_mon_vao_ban_dang_ngoi(): void
    {
        $donId = $this->moDon()->json('id');
        $this->cafe->update(['status' => 'closed']);

        $this->putJson("/api/cafes/{$this->cafe->id}/orders/{$donId}", [
            'items' => [['item_id' => (string) $this->item->id, 'item_name_snapshot' => 'Cà phê sữa', 'quantity' => 3]],
        ])->assertStatus(200);
    }

    /** Đóng cửa là tạm nghỉ, chủ quán vẫn sửa thực đơn chuẩn bị cho hôm sau. */
    public function test_quan_dong_cua_van_sua_duoc_thuc_don(): void
    {
        $this->cafe->update(['status' => 'closed']);

        $this->postJson("/api/cafes/{$this->cafe->id}/toppings", ['name' => 'Trân châu', 'price' => 5_000])
            ->assertStatus(201);
    }

    // --- 4.1.3 Ngừng hoạt động ------------------------------------------------------

    public function test_quan_ngung_hoat_dong_thi_khong_ban_hang(): void
    {
        $this->cafe->update(['status' => 'inactive']);

        $this->moDon()
            ->assertStatus(422)
            ->assertJsonPath('message', 'Quán đang ở trạng thái "Ngừng hoạt động" nên không bán hàng được.');
    }

    public function test_quan_ngung_hoat_dong_thi_khong_sua_duoc_thuc_don(): void
    {
        $this->cafe->update(['status' => 'inactive']);
        $thongBao = 'Quán đang ở trạng thái "Ngừng hoạt động" nên chỉ tra cứu được, không thay đổi dữ liệu.';

        $this->postJson("/api/cafes/{$this->cafe->id}/items", [
            'category_id' => (string) $this->item->category_id, 'name' => 'Món mới', 'base_price' => 10_000,
        ])->assertStatus(422)->assertJsonPath('message', $thongBao);

        $this->postJson("/api/cafes/{$this->cafe->id}/tables", ['name' => 'Bàn 9', 'capacity' => 2])
            ->assertStatus(422)->assertJsonPath('message', $thongBao);

        $this->postJson("/api/cafes/{$this->cafe->id}/categories", ['name' => 'Danh mục mới'])
            ->assertStatus(422)->assertJsonPath('message', $thongBao);
    }

    /** Vẫn phải TRA CỨU được — đó là lý do hệ thống không cho xóa quán. */
    public function test_quan_ngung_hoat_dong_van_xem_duoc_so_lieu_cu(): void
    {
        $donId = $this->moDon()->json('id');
        $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$donId}/pay", ['payment_method' => 'cash']);
        $this->cafe->update(['status' => 'inactive']);

        $this->getJson("/api/cafes/{$this->cafe->id}/orders?status=paid")->assertStatus(200)->assertJsonCount(1);
        $this->getJson("/api/cafes/{$this->cafe->id}/items")->assertStatus(200);
    }

    /** Đổi lại "Đang mở cửa" là quán chạy tiếp — không có gì bị mất. */
    public function test_mo_lai_quan_thi_ban_hang_tro_lai_binh_thuong(): void
    {
        $this->cafe->update(['status' => 'inactive']);
        $this->moDon()->assertStatus(422);

        $this->putJson("/api/cafes/{$this->cafe->id}", ['status' => 'open'])->assertStatus(200);
        $this->moDon()->assertStatus(201);
    }

    // --- 4.1.1 Quán thứ hai chưa có gói ---------------------------------------------

    /**
     * Gói tính theo TỪNG QUÁN, không theo chủ quán: tạo quán thứ hai thì quán đó chưa
     * có gói nào và chưa dùng được gì cho tới khi mua. Nếu không, một gói Pro mua cho
     * quán A sẽ mở khóa vô hạn số quán.
     */
    public function test_quan_thu_hai_chua_mua_goi_thi_khong_dung_duoc_chuc_nang(): void
    {
        $quanMoi = $this->postJson('/api/cafes', ['name' => 'Quán thứ hai'])
            ->assertStatus(201)->json('id');

        $this->postJson("/api/cafes/{$quanMoi}/tables", ['name' => 'Bàn 1', 'capacity' => 4])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Quán này cần kích hoạt gói dịch vụ để sử dụng chức năng này.');

        $this->postJson("/api/cafes/{$quanMoi}/items", ['name' => 'Món', 'base_price' => 10_000, 'category_id' => 'x'])
            ->assertStatus(403);
    }

    /** Mua gói cho quán thứ hai rồi thì nó chạy độc lập với quán thứ nhất. */
    public function test_quan_thu_hai_co_goi_rieng_thi_dung_duoc(): void
    {
        $quanMoi = Cafe::find($this->postJson('/api/cafes', ['name' => 'Quán thứ hai'])->json('id'));
        $this->capGoi($quanMoi);

        $this->postJson("/api/cafes/{$quanMoi->id}/tables", ['name' => 'Bàn 1', 'capacity' => 4])
            ->assertStatus(201);
    }

    /** Không có đường xóa quán ở bất kỳ đâu (4.1.4) — dữ liệu quán là gốc của mọi thứ. */
    public function test_khong_co_duong_xoa_quan(): void
    {
        $this->deleteJson("/api/cafes/{$this->cafe->id}")->assertStatus(405);
        $this->assertNotNull(Cafe::find((string) $this->cafe->id));
    }
}
