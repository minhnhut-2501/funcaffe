<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Package;
use App\Models\Product;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\Topping;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;

/**
 * PHÂN QUYỀN TÀI KHOẢN NHÂN VIÊN.
 *
 * Bài quan trọng nhất ở đây là `test_moi_tuyen_deu_da_duoc_phan_loai`: nó duyệt TOÀN
 * BỘ bảng tuyến thay vì liệt kê tay. Middleware `chu-quan` hoạt động theo danh sách
 * đen, nghĩa là tuyến MỚI thêm sau này mặc định nhân viên VÀO ĐƯỢC — đúng chiều nguy
 * hiểm. Bài quét này là thứ bắt lỗi đó ngay khi ai đó thêm tuyến mà quên phân loại.
 *
 * Chỗ nguy hiểm nhất là `POST shops/{shop}/subscriptions`: nó tạo giao dịch mua gói.
 * Sót nó là nhân viên tiêu tiền của chủ quán.
 */
class StaffPermissionTest extends MongoTestCase
{
    /**
     * Cần cho bài đổi mật khẩu: `changePassword` thu hồi token cũ, tức có đụng bảng
     * `personal_access_tokens` bên SQLite. `Sanctum::actingAs` không tạo bảng đó.
     * Cùng lối với AuthFlowTest.
     */
    use RefreshDatabase;

    protected array $collections = [
        'users', 'shops', 'packages', 'subscriptions', 'package_payments', 'categories',
        'products', 'product_sizes', 'toppings', 'tables', 'orders',
        'order_details', 'order_detail_toppings', 'reviews',
    ];

    private User $chu;
    private User $nhanVien;
    private Shop $shop;
    private Product $product;
    private $table;

    protected function setUp(): void
    {
        parent::setUp();

        $this->chu = User::create([
            'full_name' => 'Chủ quán', 'email' => 'chu-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'), 'role' => 'user', 'status' => 'active',
        ]);
        $this->shop = $this->chu->shops()->create(['name' => 'Quán có nhân viên', 'status' => 'open']);

        $package = Package::create([
            'name' => 'Pro Max', 'type' => 'promax', 'level' => 2, 'status' => 'active',
            'is_trial' => false, 'can_use_ai' => true, 'max_staff' => null,
        ]);
        Subscription::create([
            'shop_id' => (string) $this->shop->id, 'package_id' => (string) $package->id,
            'package_name_snapshot' => $package->name,
            'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
            'total_amount' => 199_000, 'status' => 'active',
        ]);

        $cat = Category::create(['shop_id' => (string) $this->shop->id, 'name' => 'Cà phê', 'is_active' => true]);
        $this->product = Product::create([
            'shop_id' => (string) $this->shop->id, 'category_id' => (string) $cat->id,
            'name' => 'Cà phê sữa', 'base_price' => 30_000, 'is_available' => true,
        ]);
        $this->table = $this->shop->tables()->create([
            'name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty', 'is_active' => true,
        ]);

        $this->nhanVien = User::create([
            'full_name' => 'Nhân viên A', 'email' => 'nv-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'), 'role' => 'staff', 'status' => 'active',
            'shop_id' => (string) $this->shop->id,
        ]);
    }

    private function nhuNhanVien(): void
    {
        Sanctum::actingAs($this->nhanVien);
    }

    private function url(string $duoi): string
    {
        return "/api/shops/{$this->shop->id}/{$duoi}";
    }

    // === Việc nhân viên PHẢI làm được ==========================================

    public function test_nhan_vien_doc_duoc_moi_thu_can_de_ban(): void
    {
        $this->nhuNhanVien();

        foreach (['products', 'categories', 'toppings', 'tables'] as $ep) {
            $this->getJson($this->url($ep))->assertStatus(200);
        }
        $this->getJson($this->url('orders?status=active'))->assertStatus(200);
        $this->getJson('/api/shops')->assertStatus(200);
        $this->getJson('/api/user')->assertStatus(200);
    }

    public function test_nhan_vien_ban_duoc_hang_va_thu_tien(): void
    {
        $this->nhuNhanVien();

        $id = $this->postJson($this->url('orders'), [
            'table_id' => (string) $this->table->id,
            'items' => [['product_id' => (string) $this->product->id,
                'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 2]],
        ])->assertStatus(201)->json('id');

        $this->postJson($this->url("orders/{$id}/pay"), [
            'payment_method' => 'cash', 'cash_received' => 100_000,
        ])->assertStatus(200)->assertJsonPath('status', 'paid');

        // Và đơn phải ghi đúng người bán — đây là điểm của việc có tài khoản riêng.
        $this->assertSame((string) $this->nhanVien->id, Order::find($id)->created_by);
        $this->assertSame((string) $this->nhanVien->id, Order::find($id)->paid_by);
    }

    public function test_nhan_vien_ban_duoc_mang_ve(): void
    {
        $this->nhuNhanVien();

        $this->postJson($this->url('orders'), [
            'order_type' => 'takeaway',
            'items' => [['product_id' => (string) $this->product->id,
                'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 1]],
            'payment_method' => 'cash', 'cash_received' => 50_000,
        ])->assertStatus(201)->assertJsonPath('status', 'paid');
    }

    public function test_nhan_vien_doi_duoc_mat_khau_cua_chinh_minh(): void
    {
        $this->nhuNhanVien();

        $this->putJson('/api/user/password', [
            'current_password' => 'Password@123',
            'new_password' => 'MatKhauMoi@456',
            'confirm_password' => 'MatKhauMoi@456',
        ])->assertStatus(200);
    }

    // === Việc nhân viên KHÔNG được làm =========================================

    /** Chỗ nguy hiểm nhất: mua gói bằng tiền của chủ quán. */
    public function test_nhan_vien_KHONG_mua_duoc_goi(): void
    {
        $this->nhuNhanVien();
        $goi = Package::where('type', 'promax')->first();

        $this->postJson($this->url('subscriptions'), [
            'package_id' => (string) $goi->id, 'payment_method' => 'vnpay',
        ])->assertStatus(403);

        $this->getJson($this->url('subscriptions'))->assertStatus(403);
        $this->getJson($this->url('subscriptions/payments'))->assertStatus(403);
    }

    public function test_nhan_vien_KHONG_xem_duoc_doanh_thu(): void
    {
        $this->nhuNhanVien();

        $this->getJson('/api/revenue/overview')->assertStatus(403);
        $this->getJson('/api/revenue/summary')->assertStatus(403);
    }

    public function test_nhan_vien_KHONG_sua_duoc_thuc_don_va_ban(): void
    {
        $this->nhuNhanVien();

        $this->postJson($this->url('products'), ['name' => 'Món lậu', 'base_price' => 1000])
            ->assertStatus(403);
        $this->putJson($this->url("products/{$this->product->id}"), ['base_price' => 1])
            ->assertStatus(403);
        $this->postJson($this->url('categories'), ['name' => 'DM lậu'])->assertStatus(403);
        $this->postJson($this->url('toppings'), ['name' => 'Top lậu', 'price' => 1000])
            ->assertStatus(403);
        $this->postJson($this->url('tables'), ['name' => 'Bàn lậu', 'capacity' => 2])
            ->assertStatus(403);
        $this->putJson($this->url("tables/{$this->table->id}"), ['is_active' => false])
            ->assertStatus(403);

        // Và giá món phải còn nguyên.
        $this->assertSame(30_000, (int) $this->product->fresh()->base_price);
    }

    public function test_nhan_vien_KHONG_dung_duoc_tro_ly_AI(): void
    {
        $this->nhuNhanVien();

        $this->postJson($this->url('ai/chat'), ['message' => 'Doanh thu hôm nay?'])
            ->assertStatus(403);
        $this->getJson($this->url('ai/suggestions'))->assertStatus(403);
    }

    public function test_nhan_vien_KHONG_tao_hay_sua_duoc_quan(): void
    {
        $this->nhuNhanVien();

        $this->postJson('/api/shops', ['name' => 'Quán riêng của tôi'])->assertStatus(403);
        $this->putJson("/api/shops/{$this->shop->id}", ['name' => 'Đổi tên quán'])->assertStatus(403);
        $this->assertSame('Quán có nhân viên', $this->shop->fresh()->name);
    }

    public function test_nhan_vien_KHONG_quan_ly_duoc_nhan_vien_khac(): void
    {
        $this->nhuNhanVien();

        $this->getJson($this->url('staff'))->assertStatus(403);
        $this->postJson($this->url('staff'), [
            'full_name' => 'Đồng bọn', 'email' => 'x@funcafe.test', 'password' => 'Password@123',
        ])->assertStatus(403);
    }

    public function test_nhan_vien_KHONG_dai_dien_chu_quan_danh_gia_phan_mem(): void
    {
        $this->nhuNhanVien();
        $this->getJson('/api/reviews/mine')->assertStatus(403);
        $this->postJson($this->url('reviews'), ['rating' => 5, 'comment' => 'Tuyệt'])->assertStatus(403);
    }

    public function test_nhan_vien_KHONG_vao_duoc_quan_khac(): void
    {
        $khac = User::create([
            'full_name' => 'Chủ khác', 'email' => 'khac-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'), 'role' => 'user', 'status' => 'active',
        ]);
        $quanKhac = $khac->shops()->create(['name' => 'Quán khác', 'status' => 'open']);

        $this->nhuNhanVien();
        $this->getJson("/api/shops/{$quanKhac->id}/products")->assertStatus(403);
        $this->getJson("/api/shops/{$quanKhac->id}/orders")->assertStatus(403);
    }

    /**
     * `shop_id` là trường TÙY CHỌN, nên phải chốt rõ: trống = KHÔNG vào được quán nào,
     * chứ không phải vào được mọi quán. Dữ liệu hỏng thì khóa chặt, không mở toang.
     */
    public function test_nhan_vien_khong_gan_quan_thi_khong_vao_duoc_dau_ca(): void
    {
        $moCoi = User::create([
            'full_name' => 'Nhân viên mồ côi', 'email' => 'mc-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'), 'role' => 'staff', 'status' => 'active',
        ]);
        Sanctum::actingAs($moCoi);

        $this->getJson($this->url('products'))->assertStatus(403);
        $this->getJson($this->url('orders'))->assertStatus(403);
    }

    /**
     * Chủ quán khóa được nhân viên, và mở lại được.
     *
     * Phần "token đang cầm mất hiệu lực ngay" KHÔNG kiểm lại ở đây — cơ chế đó nằm ở
     * `EnsureAccountActive`, không phân biệt vai trò, và đã có bài riêng:
     * `AuthFlowTest::test_khoa_giua_phien_thi_token_dang_cam_het_hieu_luc`. Dựng lại
     * nó ở đây chỉ để thêm chữ "nhân viên" là chép việc, mà còn phải kéo theo
     * `RefreshDatabase` cho bảng token của Sanctum.
     */
    public function test_chu_quan_khoa_va_mo_lai_duoc_nhan_vien(): void
    {
        Sanctum::actingAs($this->chu);

        $this->putJson($this->url("staff/{$this->nhanVien->id}"), ['status' => 'locked'])
            ->assertStatus(200);
        $this->assertSame('locked', $this->nhanVien->fresh()->status);

        $this->putJson($this->url("staff/{$this->nhanVien->id}"), ['status' => 'active'])
            ->assertStatus(200);
        $this->assertSame('active', $this->nhanVien->fresh()->status);
    }

    // === Bài quét toàn bảng tuyến ==============================================

    /**
     * MỌI tuyến đều phải được phân loại: hoặc nhân viên dùng được (nằm trong danh sách
     * trắng dưới đây), hoặc bị `chu-quan` chặn.
     *
     * Đi qua bảng tuyến thật thay vì liệt kê tay, để tuyến MỚI thêm sau này cũng tự
     * được kiểm. Ai thêm một endpoint mà quên nghĩ tới nhân viên sẽ thấy bài này đỏ.
     */
    public function test_moi_tuyen_deu_da_duoc_phan_loai(): void
    {
        // Nhân viên ĐƯỢC dùng — mỗi dòng là một quyết định có cân nhắc, không phải
        // danh sách cho qua. Sửa danh sách này nghĩa là đang mở rộng quyền nhân viên.
        $choPhep = [
            'api/user',                                   // hồ sơ của chính mình
            'api/user/password',
            'api/auth/logout',
            'api/shops',                                  // GET: quán mình làm
            'api/shops/{shop}',                           // GET
            'api/shops/{shop}/products',
            'api/shops/{shop}/categories',
            'api/shops/{shop}/toppings',
            'api/shops/{shop}/tables',
            'api/shops/{shop}/orders',
            'api/shops/{shop}/orders/{order}',
            'api/shops/{shop}/orders/{order}/pay',
            'api/shops/{shop}/orders/{order}/cancel',
            'api/shops/{shop}/orders/{order}/vnpay',
        ];

        $chuaPhanLoai = [];

        foreach (Route::getRoutes() as $r) {
            $uri = $r->uri();
            $mw  = $r->gatherMiddleware();

            // Chỉ xét tuyến CẦN ĐĂNG NHẬP. Tuyến công khai (bảng giá, liên hệ, callback
            // cổng thanh toán) không dính dáng tới vai trò.
            if (!in_array('auth:sanctum', $mw, true)) {
                continue;
            }
            // Khu admin đã có lớp chặn riêng.
            if (str_starts_with($uri, 'api/admin')) {
                continue;
            }

            $biChan   = in_array('chu-quan', $mw, true);
            $duocPhep = in_array($uri, $choPhep, true);

            if ($biChan || $duocPhep) {
                continue;
            }

            $cach = collect($r->methods())->first(fn ($m) => !in_array($m, ['HEAD', 'OPTIONS'], true));
            $chuaPhanLoai[] = "{$cach} {$uri}";
        }

        $this->assertSame([], $chuaPhanLoai,
            "Có tuyến chưa phân loại cho tài khoản nhân viên.\n"
            . "Mỗi tuyến phải HOẶC gắn middleware 'chu-quan', HOẶC nằm trong danh sách\n"
            . "trắng \$choPhep của bài kiểm này (và việc thêm vào đó là một quyết định\n"
            . "mở rộng quyền, phải cân nhắc):\n  " . implode("\n  ", $chuaPhanLoai));
    }
}
