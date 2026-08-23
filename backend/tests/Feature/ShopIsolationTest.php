<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\Category;
use App\Models\Product;
use App\Models\Order;
use App\Models\Package;
use App\Models\Subscription;
use App\Models\ShopTable;
use App\Models\Topping;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * RANH GIỚI GIỮA HAI QUÁN — bất biến quan trọng nhất của một hệ thống nhiều người dùng.
 *
 * Mỗi chủ quán chỉ được thấy và sửa dữ liệu quán của chính mình. Rò rỉ ở đây không chỉ
 * là lỗi kỹ thuật: đó là doanh thu, thực đơn và giá bán của một quán lọt sang tay quán
 * khác — thường là đối thủ trong cùng khu.
 *
 * Bài này KHÔNG liệt kê tay từng endpoint. Nó đi qua **bảng route thật**, thay mã quán
 * của người khác vào từng đường rồi khẳng định máy chủ từ chối. Thêm một endpoint mới
 * mà quên chốt chặn thì bài này đỏ ngay, không cần ai nhớ cập nhật danh sách — mà "quên
 * một chỗ" chính là cách những lỗ hổng kiểu này ra đời.
 *
 * Chấp nhận cả 403 (biết quán đó có, nhưng không phải của bạn) lẫn 404 (coi như không
 * tồn tại). Điều KHÔNG chấp nhận là 2xx.
 */
class ShopIsolationTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'shops', 'packages', 'subscriptions', 'categories', 'products',
        'product_sizes', 'toppings', 'tables', 'orders', 'order_details', 'reviews',
    ];

    private User $chuA;
    private User $chuB;
    private Shop $quanA;
    private Category $danhMucA;
    private Product $monA;
    private Topping $toppingA;
    private ShopTable $banA;
    private Order $donA;

    protected function setUp(): void
    {
        parent::setUp();

        $goi = Package::create([
            'name' => 'Pro Max', 'type' => 'promax', 'level' => 2,
            'status' => 'active', 'is_trial' => false, 'can_use_ai' => true,
        ]);

        $this->chuA = $this->taoChuQuan('a');
        $this->chuB = $this->taoChuQuan('b');

        $this->quanA = $this->chuA->shops()->create(['name' => 'Quán của A', 'status' => 'open']);
        // Quán B tồn tại để B là một chủ quán hợp lệ, không phải kẻ lạ không có gì.
        $this->chuB->shops()->create(['name' => 'Quán của B', 'status' => 'open']);

        foreach ([$this->quanA->id, Shop::where('name', 'Quán của B')->first()->id] as $cid) {
            Subscription::create([
                'shop_id' => (string) $cid, 'package_id' => (string) $goi->id,
                'package_name_snapshot' => 'Pro Max',
                'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
                'total_amount' => 499_000, 'status' => 'active',
            ]);
        }

        $this->danhMucA = Category::create([
            'shop_id' => (string) $this->quanA->id, 'name' => 'Cà phê', 'is_active' => true,
        ]);
        $this->monA = Product::create([
            'shop_id' => (string) $this->quanA->id,
            'category_id' => (string) $this->danhMucA->id,
            'name' => 'Cà phê sữa', 'base_price' => 30_000, 'is_available' => true,
        ]);
        $this->toppingA = Topping::create([
            'shop_id' => (string) $this->quanA->id, 'name' => 'Trân châu',
            'price' => 7_000, 'is_available' => true,
        ]);
        $this->banA = $this->quanA->tables()->create([
            'name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty',
        ]);

        Sanctum::actingAs($this->chuA);
        $this->postJson("/api/shops/{$this->quanA->id}/orders", [
            'table_id' => (string) $this->banA->id,
            'items' => [['product_id' => (string) $this->monA->id, 'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 1]],
        ])->assertStatus(201);
        $this->donA = Order::where('shop_id', (string) $this->quanA->id)->firstOrFail();
    }

    private function taoChuQuan(string $dau): User
    {
        return User::create([
            'full_name' => 'Chủ quán ' . strtoupper($dau),
            'email' => $dau . '-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user', 'status' => 'active',
        ]);
    }

    /**
     * Chủ quán B gọi MỌI đường có `{shop}` bằng mã quán của A → phải bị từ chối.
     *
     * Đây là bài chính. Nó quét đủ mọi controller có route theo quán, nên không controller
     * nào lọt ra ngoài tầm kiểm — kể cả những cái viết sau này.
     */
    public function test_chu_quan_khac_khong_cham_duoc_bat_ky_duong_nao_cua_quan_nay(): void
    {
        $thayThe = [
            '{shop}' => (string) $this->quanA->id,
            '{category}' => (string) $this->danhMucA->id,
            '{item}' => (string) $this->monA->id,
            '{topping}' => (string) $this->toppingA->id,
            '{table}' => (string) $this->banA->id,
            '{order}' => (string) $this->donA->id,
        ];

        Sanctum::actingAs($this->chuB);
        $lot = [];
        $daThu = 0;

        foreach (\Illuminate\Support\Facades\Route::getRoutes() as $route) {
            $uri = $route->uri();
            if (!str_contains($uri, '{shop}')) {
                continue;
            }
            // Còn tham số nào không thay được thì bỏ qua — id giả sẽ cho 404 và che
            // mất câu trả lời thật.
            $duong = '/' . strtr($uri, $thayThe);
            if (preg_match('/\{[a-zA-Z]+\}/', $duong)) {
                continue;
            }

            $cach = collect($route->methods())->first(fn ($m) => !in_array($m, ['HEAD', 'OPTIONS'], true));
            $daThu++;

            $ma = $this->json($cach, $duong, [
                'name' => 'Đổi trộm', 'message' => 'xin chào', 'rating' => 5,
                'title' => 'Thử', 'comment' => 'Thử xem có vào được không',
                'payment_method' => 'vnpay', 'package_id' => 'x',
            ])->getStatusCode();

            if ($ma < 400) {
                $lot[] = "{$cach} {$uri} -> {$ma}";
            }
        }

        $this->assertGreaterThanOrEqual(15, $daThu, 'Số đường quét được ít bất thường — kiểm lại bộ lọc.');
        $this->assertSame([], $lot, "Chủ quán khác VÀO ĐƯỢC dữ liệu của quán này:\n" . implode("\n", $lot));
    }

    /** Chính chủ vẫn phải vào được — chốt chặn không được chặt tay tới mức khoá cả chủ. */
    public function test_chinh_chu_van_doc_duoc_du_lieu_quan_minh(): void
    {
        Sanctum::actingAs($this->chuA);

        $this->getJson("/api/shops/{$this->quanA->id}")->assertStatus(200);
        $this->getJson("/api/shops/{$this->quanA->id}/products")->assertStatus(200);
        $this->getJson("/api/shops/{$this->quanA->id}/orders")->assertStatus(200);
        $this->getJson("/api/shops/{$this->quanA->id}/revenue-summary")->assertStatus(404); // đường không tồn tại — chốt kiểm bài
    }

    /**
     * Đọc và SỬA thông tin quán người khác qua `PUT /shops/{shop}`.
     *
     * `ShopController` tự kiểm quyền chứ không dùng chốt chặn chung `authorizeShop()`,
     * nên phải soi riêng: hai chỗ viết hai kiểu là hai chỗ có thể lệch nhau.
     */
    public function test_khong_xem_va_khong_sua_duoc_thong_tin_quan_nguoi_khac(): void
    {
        Sanctum::actingAs($this->chuB);

        $this->getJson("/api/shops/{$this->quanA->id}")->assertStatus(403);
        $this->putJson("/api/shops/{$this->quanA->id}", ['name' => 'Đã bị đổi tên'])->assertStatus(403);

        $this->assertSame('Quán của A', Shop::find($this->quanA->id)->name);
    }

    /** Danh sách quán chỉ trả quán của chính mình. */
    public function test_danh_sach_quan_khong_lan_quan_nguoi_khac(): void
    {
        Sanctum::actingAs($this->chuB);

        $ten = collect($this->getJson('/api/shops')->assertStatus(200)->json())->pluck('name')->all();

        $this->assertContains('Quán của B', $ten);
        $this->assertNotContains('Quán của A', $ten);
    }

    /**
     * Doanh thu gộp chỉ cộng quán của chính mình.
     *
     * `UserRevenueController` không đi qua `{shop}` nên bài quét bảng route ở trên không
     * chạm tới. Nó gom theo `user_id` — bài này giữ đúng điều đó.
     */
    public function test_doanh_thu_gop_khong_cong_quan_nguoi_khac(): void
    {
        Sanctum::actingAs($this->chuA);
        $this->postJson("/api/shops/{$this->quanA->id}/orders/{$this->donA->id}/pay", [
            'payment_method' => 'cash',
            // Bắt buộc từ khi tiền mặt phải ghi số khách đưa; bài này soi ranh giới hai quán.
            'cash_received' => 1_000_000,
        ])->assertStatus(200);

        Sanctum::actingAs($this->chuB);
        $than = $this->getJson('/api/revenue/overview')->assertStatus(200)->json();

        $chuoi = json_encode($than, JSON_UNESCAPED_UNICODE);
        $this->assertStringNotContainsString('Quán của A', $chuoi, 'Tên quán người khác lọt vào doanh thu.');
        $this->assertStringNotContainsString((string) $this->quanA->id, $chuoi, 'Mã quán người khác lọt vào doanh thu.');
    }

    /** Quản trị viên thì được — đó là ngoại lệ CÓ CHỦ Ý, không phải lỗ hổng. */
    public function test_quan_tri_vien_van_doc_duoc_de_ho_tro(): void
    {
        $admin = User::create([
            'full_name' => 'Quản trị viên', 'email' => 'ad-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'), 'role' => 'admin', 'status' => 'active',
        ]);

        Sanctum::actingAs($admin);
        $this->getJson("/api/shops/{$this->quanA->id}")->assertStatus(200);
    }
}
