<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\Category;
use App\Models\Product;
use App\Models\Order;
use App\Models\Package;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * BÁN MANG VỀ — quán hết bàn vẫn phải bán được.
 *
 * Trước đây `table_id` là bắt buộc tuyệt đối, nên khi kín bàn thì không mở nổi một
 * đơn nào: khách mua ly cà phê đi đường cũng phải chờ có bàn trống. Đó là lỗi
 * nghiệp vụ GVHD chỉ ra ở buổi báo cáo thử.
 *
 * Hai điều tệp này khoá lại:
 *  1. Đơn mang về KHÔNG cần bàn, và KHÔNG được đụng tới bàn nào.
 *  2. Trả tiền mặt/VietQR thì tạo và chốt trong CÙNG một lượt gọi — để không bao giờ
 *     tồn tại một đơn `active` không gắn bàn (đơn đó sẽ không hiện ở đâu trên giao
 *     diện bán hàng, vì giao diện dẫn xuất mọi thứ theo bàn).
 */
class TakeawayOrderTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'shops', 'packages', 'subscriptions', 'categories',
        'products', 'product_sizes', 'toppings', 'tables', 'orders',
        'order_details', 'order_detail_toppings',
    ];

    private User $user;
    private Shop $shop;
    private Product $product;
    private $table;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Chủ quán mang về',
            'email' => 'takeaway-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $this->shop = $this->user->shops()->create(['name' => 'Quán mang về', 'status' => 'open']);

        $package = Package::create([
            'name' => 'Pro Max', 'type' => 'promax', 'level' => 2,
            'status' => 'active', 'is_trial' => false, 'can_use_ai' => true,
        ]);
        Subscription::create([
            'shop_id' => (string) $this->shop->id,
            'package_id' => (string) $package->id,
            'package_name_snapshot' => $package->name,
            'start_date' => now()->subDay(),
            'end_date' => now()->addMonth(),
            'total_amount' => 199_000,
            'status' => 'active',
        ]);

        $category = Category::create([
            'shop_id' => (string) $this->shop->id, 'name' => 'Cà phê', 'is_active' => true,
        ]);
        $this->product = Product::create([
            'shop_id' => (string) $this->shop->id,
            'category_id' => (string) $category->id,
            'name' => 'Cà phê sữa',
            'base_price' => 30_000,
            'is_available' => true,
        ]);
        $this->table = $this->shop->tables()->create([
            'name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty', 'is_active' => true,
        ]);

        Sanctum::actingAs($this->user);
    }

    private function url(string $duoi = ''): string
    {
        return "/api/shops/{$this->shop->id}/orders" . $duoi;
    }

    /** @param array<string, mixed> $them */
    private function than(array $them = []): array
    {
        return array_merge([
            'order_type' => 'takeaway',
            'items' => [[
                'product_id' => (string) $this->product->id,
                'product_name_snapshot' => 'Cà phê sữa',
                'quantity' => 2,
            ]],
        ], $them);
    }

    // --- Không cần bàn ----------------------------------------------------------

    public function test_mo_duoc_don_mang_ve_khong_can_ban(): void
    {
        $res = $this->postJson($this->url(), $this->than())->assertStatus(201);

        $this->assertSame('takeaway', $res->json('order_type'));
        $this->assertNull($res->json('table_id'), 'Đơn mang về không được gắn bàn.');
        $this->assertSame(60_000, $res->json('total_amount'));
    }

    /** Đây chính là tình huống GVHD nêu: kín bàn vẫn phải bán được. */
    public function test_het_ban_van_ban_mang_ve_duoc(): void
    {
        // Bàn duy nhất đang có khách.
        $this->postJson($this->url(), [
            'table_id' => (string) $this->table->id,
            'items' => [['product_id' => (string) $this->product->id, 'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 1]],
        ])->assertStatus(201);

        $this->postJson($this->url(), $this->than())->assertStatus(201);
    }

    public function test_ban_tai_quan_van_bat_buoc_chon_ban(): void
    {
        $this->postJson($this->url(), [
            'order_type' => 'dine_in',
            'items' => [['product_id' => (string) $this->product->id, 'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 1]],
        ])->assertStatus(422)->assertJsonPath('errors.table_id.0', 'Bán tại quán thì phải chọn bàn.');
    }

    /**
     * Client CŨ không gửi `order_type` — vẫn phải bị bắt chọn bàn như trước.
     *
     * `required_if:order_type,dine_in` không tự khớp khi trường so sánh vắng mặt, nên
     * nếu không đặt giá trị mặc định trước lúc validate thì đây là đường tạo được đơn
     * tại quán không có bàn.
     */
    public function test_khong_gui_order_type_thi_van_coi_la_tai_quan_va_bat_chon_ban(): void
    {
        $this->postJson($this->url(), [
            'items' => [['product_id' => (string) $this->product->id, 'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 1]],
        ])->assertStatus(422)->assertJsonPath('errors.table_id.0', 'Bán tại quán thì phải chọn bàn.');
    }

    // --- Không đụng tới bàn -----------------------------------------------------

    public function test_don_mang_ve_khong_lam_ban_nao_chuyen_sang_dang_phuc_vu(): void
    {
        $this->postJson($this->url(), $this->than())->assertStatus(201);

        $ban = $this->table->fresh();
        $this->assertSame('empty', $ban->status, 'Bán mang về không được chiếm bàn.');
        $this->assertNull($ban->current_order_id);
    }

    /**
     * Nhiều khách mua mang đi cùng lúc là chuyện thường. Chốt chặn "một bàn một đơn"
     * KHÔNG được áp cho mang về, nếu không thì đơn của người thứ hai bị gộp vào đơn
     * người thứ nhất — thu nhầm tiền.
     */
    public function test_hai_don_mang_ve_cung_luc_la_hai_don_rieng(): void
    {
        $a = $this->postJson($this->url(), $this->than())->assertStatus(201)->json('id');
        $b = $this->postJson($this->url(), $this->than())->assertStatus(201)->json('id');

        $this->assertNotSame($a, $b, 'Hai lượt mua mang về phải ra hai đơn khác nhau.');
        $this->assertSame(2, $this->shop->orders()->where('order_type', 'takeaway')->count());
    }

    // --- Tạo và chốt trong một lượt ---------------------------------------------

    public function test_mang_ve_tra_tien_mat_chot_luon_trong_mot_luot_goi(): void
    {
        $res = $this->postJson($this->url(), $this->than([
            'payment_method' => 'cash',
            'cash_received'  => 100_000,
        ]))->assertStatus(201);

        $this->assertSame('paid', $res->json('status'));
        $this->assertSame('paid', $res->json('payment_status'));
        $this->assertNotEmpty($res->json('invoice_code'), 'Phải sinh mã phiếu ngay.');
        $this->assertSame(100_000, $res->json('cash_received'));
        $this->assertSame(40_000, $res->json('change_amount'));
        $this->assertNotEmpty($res->json('paid_at'));
    }

    public function test_mang_ve_tra_vietqr_chot_luon_va_khong_ghi_tien_thoi(): void
    {
        $res = $this->postJson($this->url(), $this->than(['payment_method' => 'vietqr']))
            ->assertStatus(201);

        $this->assertSame('paid', $res->json('status'));
        $this->assertSame('vietqr', $res->json('payment_method'));
        $this->assertNull($res->json('cash_received'));
        $this->assertNull($res->json('change_amount'));
    }

    /**
     * Tiền khách đưa được kiểm TRƯỚC khi tạo đơn, nên đưa thiếu thì CSDL phải sạch
     * trơn — không có đơn nào nằm lại. Mongo máy đơn không có transaction để lùi.
     */
    public function test_dua_thieu_tien_thi_khong_tao_don_nao_ca(): void
    {
        $this->postJson($this->url(), $this->than([
            'payment_method' => 'cash',
            'cash_received'  => 10_000,          // cần 60.000
        ]))->assertStatus(422);

        $this->assertSame(0, $this->shop->orders()->count(), 'Không được để lại đơn ma.');
    }

    public function test_tra_tien_mat_ma_bo_trong_o_tien_thi_bi_tu_choi(): void
    {
        $this->postJson($this->url(), $this->than(['payment_method' => 'cash']))
            ->assertStatus(422);

        $this->assertSame(0, $this->shop->orders()->count());
    }

    /** Không gửi `payment_method` thì đơn mang về vẫn mở, chờ thanh toán sau. */
    public function test_khong_gui_phuong_thuc_thi_don_mang_ve_van_o_trang_thai_dang_phuc_vu(): void
    {
        $res = $this->postJson($this->url(), $this->than())->assertStatus(201);
        $this->assertSame('active', $res->json('status'));
        $this->assertNull($res->json('invoice_code'));
    }

    // --- Thanh toán / hủy về sau ------------------------------------------------

    public function test_don_mang_ve_dang_mo_van_thanh_toan_duoc_bang_duong_pay(): void
    {
        $id = $this->postJson($this->url(), $this->than())->json('id');

        $this->postJson($this->url("/{$id}/pay"), [
            'payment_method' => 'cash', 'cash_received' => 100_000,
        ])->assertStatus(200)->assertJsonPath('status', 'paid');
    }

    public function test_huy_don_mang_ve_khong_dung_toi_ban_nao(): void
    {
        $id = $this->postJson($this->url(), $this->than())->json('id');

        $this->postJson($this->url("/{$id}/cancel"))->assertStatus(200);

        $this->assertSame('cancelled', Order::find($id)->status);
        $this->assertSame('empty', $this->table->fresh()->status);
    }

    // --- Ghi nhận người bán -----------------------------------------------------

    public function test_ghi_lai_ai_mo_don_va_ai_thu_tien(): void
    {
        $res = $this->postJson($this->url(), $this->than([
            'payment_method' => 'cash', 'cash_received' => 100_000,
        ]))->assertStatus(201);

        $this->assertSame((string) $this->user->id, $res->json('created_by'));
        $this->assertSame((string) $this->user->id, $res->json('paid_by'));
    }

    // --- Doanh thu tách theo hình thức bán ---------------------------------------

    public function test_doanh_thu_tach_dung_tai_quan_va_mang_ve(): void
    {
        // Tại quán: 1 ly = 30.000
        $idTaiQuan = $this->postJson($this->url(), [
            'table_id' => (string) $this->table->id,
            'items' => [['product_id' => (string) $this->product->id, 'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 1]],
        ])->json('id');
        $this->postJson($this->url("/{$idTaiQuan}/pay"), ['payment_method' => 'cash', 'cash_received' => 100_000]);

        // Mang về: 2 ly = 60.000, chốt luôn
        $this->postJson($this->url(), $this->than(['payment_method' => 'cash', 'cash_received' => 100_000]));

        $so = $this->getJson('/api/revenue/summary')->assertStatus(200)->json();

        $this->assertSame(90_000, $so['total']);
        $this->assertSame(30_000, $so['by_order_type']['dine_in']['total']);
        $this->assertSame(1, $so['by_order_type']['dine_in']['count']);
        $this->assertSame(60_000, $so['by_order_type']['takeaway']['total']);
        $this->assertSame(1, $so['by_order_type']['takeaway']['count']);
    }

    /** Chưa bán mang về lần nào thì vẫn phải trả về 0, không được thiếu khóa. */
    public function test_chua_ban_mang_ve_thi_tra_ve_khong_chu_khong_thieu_khoa(): void
    {
        $so = $this->getJson('/api/revenue/summary')->assertStatus(200)->json();

        $this->assertArrayHasKey('takeaway', $so['by_order_type']);
        $this->assertSame(0, $so['by_order_type']['takeaway']['total']);
        $this->assertSame(0, $so['by_order_type']['takeaway']['count']);
    }

    // --- Dữ liệu cũ -------------------------------------------------------------

    /** Đơn tại quán tạo qua API phải được đánh dấu `dine_in` rõ ràng. */
    public function test_don_tai_quan_duoc_danh_dau_dine_in(): void
    {
        $res = $this->postJson($this->url(), [
            'table_id' => (string) $this->table->id,
            'items' => [['product_id' => (string) $this->product->id, 'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 1]],
        ])->assertStatus(201);

        $this->assertSame('dine_in', $res->json('order_type'));
        $this->assertSame('serving', $this->table->fresh()->status);
    }
}
