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
 * Vòng đời một đơn hàng: mở → thêm món → thanh toán / hủy.
 *
 * `OrderPricingTest` giữ phần TIỀN. Tệp này giữ phần TRẠNG THÁI — những đường đi mà
 * một đơn có thể lạc vào: chốt hai lần, vừa hủy vừa thu, đơn rỗng, đơn treo qua đêm.
 * Mongo standalone không có transaction nên mọi bảo vệ ở đây phải nằm trong chính
 * câu lệnh ghi, không phải trong một lần đọc trước đó.
 */
class OrderLifecycleTest extends MongoTestCase
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
            'full_name' => 'Chủ quán vòng đời đơn',
            'email' => 'life-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $this->shop = $this->user->shops()->create(['name' => 'Quán vòng đời', 'status' => 'open']);

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
        $this->item = Product::create([
            'shop_id' => (string) $this->shop->id,
            'category_id' => (string) $category->id,
            'name' => 'Cà phê sữa',
            'base_price' => 30_000,
            'is_available' => true,
        ]);
        $this->table = $this->shop->tables()->create(['name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty']);

        Sanctum::actingAs($this->user);
    }

    private function taoDon(int $soLuong = 2): string
    {
        return $this->postJson("/api/shops/{$this->shop->id}/orders", [
            'table_id' => (string) $this->table->id,
            'items' => [[
                'product_id' => (string) $this->item->id,
                'product_name_snapshot' => 'Cà phê sữa',
                'quantity' => $soLuong,
            ]],
        ])->json('id');
    }

    /**
     * Trả tiền mặt, đưa dư sức. Từ khi `cash_received` thành bắt buộc cho tiền mặt,
     * mọi lệnh thanh toán đều phải mang con số này — nhưng các bài dưới đây soi mã
     * phiếu và vòng đời đơn, không soi tiền thối, nên số cụ thể không quan trọng.
     */
    private function traTienMat(): array
    {
        return ['payment_method' => 'cash', 'cash_received' => 1_000_000];
    }

    // --- 4.6.10 Thanh toán hai lần ---------------------------------------------

    /**
     * Bấm đúp / mở hai tab: lệnh thứ hai phải bị từ chối VÀ không được ghi đè mã
     * phiếu của lệnh thứ nhất. Kiểm cả hai vế: một cái 400 mà vẫn kịp ghi đè thì
     * hóa đơn đưa khách và hóa đơn trong sổ mang hai mã khác nhau.
     */
    public function test_thanh_toan_lan_hai_bi_tu_choi_va_khong_ghi_de_ma_phieu(): void
    {
        $orderId = $this->taoDon();
        $url = "/api/shops/{$this->shop->id}/orders/{$orderId}/pay";

        $maPhieu = $this->postJson($url, $this->traTienMat())
            ->assertStatus(200)
            ->json('invoice_code');

        $this->postJson($url, ['payment_method' => 'vietqr'])->assertStatus(400);

        $don = Order::find($orderId);
        $this->assertSame($maPhieu, $don->invoice_code, 'Mã phiếu bị lệnh thứ hai ghi đè.');
        $this->assertSame('cash', $don->payment_method, 'Phương thức thanh toán bị lệnh thứ hai ghi đè.');
    }

    /** Chỉ đúng MỘT mã phiếu tồn tại cho một đơn, dù gọi lệnh thanh toán ba lần. */
    public function test_mot_don_chi_sinh_mot_ma_phieu(): void
    {
        $orderId = $this->taoDon();
        $url = "/api/shops/{$this->shop->id}/orders/{$orderId}/pay";

        $this->postJson($url, $this->traTienMat());
        $this->postJson($url, $this->traTienMat());
        $this->postJson($url, $this->traTienMat());

        $soPhieu = $this->shop->orders()->whereNotNull('invoice_code')->count();
        $this->assertSame(1, $soPhieu);
    }

    // --- 4.6.5 Đơn rỗng ---------------------------------------------------------

    /**
     * Gỡ hết món rồi bấm nhầm Thanh toán thay vì Hủy order: phải bị chặn. Một hóa
     * đơn 0₫ nằm trong sổ vẫn được đếm là "một đơn hôm nay" và kéo giá trị trung
     * bình mỗi đơn xuống.
     */
    public function test_khong_thanh_toan_duoc_don_khong_con_mon_nao(): void
    {
        $orderId = $this->taoDon();

        // Giao diện gỡ dòng cuối cùng -> gửi danh sách món rỗng.
        $this->putJson("/api/shops/{$this->shop->id}/orders/{$orderId}", ['items' => []])
            ->assertStatus(200);

        $this->postJson("/api/shops/{$this->shop->id}/orders/{$orderId}/pay", $this->traTienMat())
            ->assertStatus(422)
            ->assertJsonPath('message', 'Đơn chưa có món nào, không thể thanh toán.');
    }

    // --- 4.6.11 Hủy đơn ---------------------------------------------------------

    public function test_huy_don_tra_ban_ve_trong(): void
    {
        $orderId = $this->taoDon();
        $this->assertSame('serving', $this->table->fresh()->status);

        $this->postJson("/api/shops/{$this->shop->id}/orders/{$orderId}/cancel")->assertStatus(200);

        $this->assertSame('cancelled', Order::find($orderId)->status);
        $this->assertSame('empty', $this->table->fresh()->status);
        $this->assertNull($this->table->fresh()->current_order_id);
    }

    public function test_don_da_thanh_toan_thi_khong_huy_duoc(): void
    {
        $orderId = $this->taoDon();
        $this->postJson("/api/shops/{$this->shop->id}/orders/{$orderId}/pay", $this->traTienMat());

        $this->postJson("/api/shops/{$this->shop->id}/orders/{$orderId}/cancel")
            ->assertStatus(400)
            ->assertJsonPath('message', 'Order đã thanh toán, không thể hủy.');

        $this->assertSame('paid', Order::find($orderId)->status, 'Đơn đã thu tiền bị đổi sang trạng thái hủy.');
    }

    /** Giao diện gọi lại lệnh hủy sau khi mất mạng là chuyện bình thường — không được báo lỗi. */
    public function test_huy_lai_don_da_huy_van_tra_ve_thanh_cong(): void
    {
        $orderId = $this->taoDon();
        $url = "/api/shops/{$this->shop->id}/orders/{$orderId}/cancel";

        $this->postJson($url)->assertStatus(200);
        $this->postJson($url)->assertStatus(200);
    }

    public function test_don_da_huy_thi_khong_thanh_toan_duoc(): void
    {
        $orderId = $this->taoDon();
        $this->postJson("/api/shops/{$this->shop->id}/orders/{$orderId}/cancel");

        $this->postJson("/api/shops/{$this->shop->id}/orders/{$orderId}/pay", $this->traTienMat())
            ->assertStatus(400);

        $this->assertNull(Order::find($orderId)->invoice_code, 'Đơn đã hủy vẫn sinh ra mã phiếu.');
    }

    // --- Request bị từ chối không được để lại dấu vết ------------------------------

    /**
     * Gọi ba món mà món thứ ba vừa bị ẩn: cả đơn bị từ chối và CSDL phải sạch như
     * chưa có request nào. Trước đây đơn được ghi trước rồi mới thêm từng dòng, nên
     * cái đơn rỗng nằm lại ở trạng thái đang phục vụ: bàn kẹt trên sơ đồ, và lần gọi
     * món sau bị nhánh "chống tạo order trùng" trả về chính cái đơn ma đó.
     */
    public function test_don_bi_tu_choi_khong_de_lai_don_ma_lam_ket_ban(): void
    {
        $monAn = Product::create([
            'shop_id' => (string) $this->shop->id,
            'name' => 'Bánh mì', 'base_price' => 25_000, 'is_available' => false,
        ]);

        $this->postJson("/api/shops/{$this->shop->id}/orders", [
            'table_id' => (string) $this->table->id,
            'items' => [
                ['product_id' => (string) $this->item->id, 'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 1],
                ['product_id' => (string) $monAn->id, 'product_name_snapshot' => 'Bánh mì', 'quantity' => 1],
            ],
        ])->assertStatus(422);

        $this->assertSame(0, $this->shop->orders()->count(), 'Đơn bị từ chối vẫn để lại bản ghi trong CSDL.');
        $this->assertSame('empty', $this->table->fresh()->status, 'Bàn bị kẹt ở trạng thái đang phục vụ.');

        // Và bàn vẫn gọi món mới được như bình thường.
        $this->postJson("/api/shops/{$this->shop->id}/orders", [
            'table_id' => (string) $this->table->id,
            'items' => [['product_id' => (string) $this->item->id, 'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 1]],
        ])->assertStatus(201);
    }

    /**
     * Sửa đơn mà một dòng không hợp lệ: đơn CŨ phải còn nguyên. Trước đây các dòng cũ
     * bị xóa ngay đầu vòng lặp, nên một request bị từ chối làm bay sạch món của bàn
     * đang ngồi — nhân viên tải lại trang thì thấy đơn 0₫.
     */
    public function test_sua_don_that_bai_khong_lam_mat_mon_dang_co(): void
    {
        $orderId = $this->taoDon(2);   // 60.000
        $monAn = Product::create([
            'shop_id' => (string) $this->shop->id,
            'name' => 'Bánh mì', 'base_price' => 25_000, 'is_available' => false,
        ]);

        $this->putJson("/api/shops/{$this->shop->id}/orders/{$orderId}", [
            'items' => [
                ['product_id' => (string) $this->item->id, 'product_name_snapshot' => 'Cà phê sữa', 'quantity' => 5],
                ['product_id' => (string) $monAn->id, 'product_name_snapshot' => 'Bánh mì', 'quantity' => 1],
            ],
        ])->assertStatus(422);

        $don = $this->getJson("/api/shops/{$this->shop->id}/orders/{$orderId}")->json();
        $this->assertCount(1, $don['order_details'], 'Dòng món cũ bị xóa mất sau một request hỏng.');
        $this->assertSame(2, (int) $don['order_details'][0]['quantity']);
        $this->assertSame(60_000.0, (float) $don['subtotal'], 'Tạm tính không còn khớp với các dòng món.');
    }

    // --- 4.6.12 Đơn treo qua ngày ------------------------------------------------

    /**
     * Bàn gọi đồ lúc 23h50, trả tiền lúc 0h10 hôm sau: doanh thu ghi vào NGÀY TRẢ
     * TIỀN, không phải ngày mở đơn. Đây là điều `OrderController::index` dựa vào khi
     * lọc `status=paid` theo `paid_at`, và cũng là điều trang Doanh thu đang cộng.
     */
    public function test_don_mo_hom_qua_tra_tien_hom_nay_tinh_vao_hom_nay(): void
    {
        $orderId = $this->taoDon();
        // Kéo ngày tạo về hôm qua, giữ nguyên trạng thái đang phục vụ.
        Order::where('_id', $orderId)->update(['created_at' => now()->subDay()]);

        $this->postJson("/api/shops/{$this->shop->id}/orders/{$orderId}/pay", $this->traTienMat())
            ->assertStatus(200);

        $homNay  = now()->format('Y-m-d');
        $homQua  = now()->subDay()->format('Y-m-d');

        $donHomNay = $this->getJson("/api/shops/{$this->shop->id}/orders?status=paid&from={$homNay}&to={$homNay}")->json();
        $donHomQua = $this->getJson("/api/shops/{$this->shop->id}/orders?status=paid&from={$homQua}&to={$homQua}")->json();

        $this->assertCount(1, $donHomNay, 'Đơn trả tiền hôm nay phải nằm trong doanh thu hôm nay.');
        $this->assertCount(0, $donHomQua, 'Đơn không được tính vào ngày mở đơn.');
    }

    /** Đơn treo mở lại vẫn sửa được và tính lại đúng tiền. */
    public function test_don_treo_qua_dem_van_them_duoc_mon(): void
    {
        $orderId = $this->taoDon(1);
        Order::where('_id', $orderId)->update(['created_at' => now()->subDay()]);

        $res = $this->putJson("/api/shops/{$this->shop->id}/orders/{$orderId}", [
            'items' => [[
                'product_id' => (string) $this->item->id,
                'product_name_snapshot' => 'Cà phê sữa',
                'quantity' => 3,
            ]],
        ]);

        $res->assertStatus(200);
        $this->assertSame(90_000.0, (float) $res->json('subtotal'));
    }

    // --- 4.3.2 Sửa giá món khi đơn đang mở ---------------------------------------

    /**
     * QUY TẮC ĐÃ CHỐT: đơn đang mở giữ giá của lúc bỏ món vào giỏ; chỉ khi sửa lại
     * đơn (thêm/bớt món) thì mới tính theo giá mới.
     *
     * Lý do chọn hướng này: nhân viên đã báo giá cho khách rồi, đổi số ngay dưới tay
     * họ là mất tin. Còn khi đơn được sửa thì dù sao cũng phải đọc lại thực đơn.
     */
    public function test_doi_gia_mon_khong_lam_doi_don_dang_mo(): void
    {
        $orderId = $this->taoDon(2);   // 30.000 x 2 = 60.000

        $this->item->update(['base_price' => 50_000]);

        $don = $this->getJson("/api/shops/{$this->shop->id}/orders/{$orderId}")->json();
        $this->assertSame(60_000.0, (float) $don['subtotal'], 'Đơn đang mở bị đổi giá dưới tay nhân viên.');
    }

    public function test_sua_lai_don_thi_ap_gia_moi(): void
    {
        $orderId = $this->taoDon(2);
        $this->item->update(['base_price' => 50_000]);

        $res = $this->putJson("/api/shops/{$this->shop->id}/orders/{$orderId}", [
            'items' => [[
                'product_id' => (string) $this->item->id,
                'product_name_snapshot' => 'Cà phê sữa',
                'quantity' => 2,
            ]],
        ]);

        $this->assertSame(100_000.0, (float) $res->json('subtotal'));
    }
}
