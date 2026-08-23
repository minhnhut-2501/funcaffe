<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductSize;
use App\Models\Package;
use App\Models\Subscription;
use App\Models\Topping;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Luật của thực đơn: danh mục, món, size, topping, bàn.
 *
 * Hai nhóm luật được giữ ở đây:
 *  1. TIỀN LUÔN LÀ SỐ NGUYÊN ĐỒNG. Một chỗ lọt số thực là nó nhân lên qua số phần
 *     topping và số ly rồi hiện ra hóa đơn dưới dạng số lẻ mà không ai gõ vào.
 *  2. KHÔNG HAI THỨ CÙNG TÊN trong một quán. Hai ô "Bàn 5" trên sơ đồ là bưng nhầm
 *     đồ và thu nhầm tiền, chứ không chỉ là xấu.
 */
class CatalogRulesTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'shops', 'packages', 'subscriptions', 'categories',
        'products', 'product_sizes', 'toppings', 'tables', 'orders',
        'order_details', 'order_detail_toppings',
    ];

    private User $user;
    private Shop $shop;
    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Chủ quán thực đơn',
            'email' => 'menu-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $this->shop = $this->user->shops()->create(['name' => 'Quán thực đơn', 'status' => 'open']);

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

        $this->category = Category::create([
            'shop_id' => (string) $this->shop->id, 'name' => 'Cà phê', 'is_active' => true,
        ]);

        Sanctum::actingAs($this->user);
    }

    private function url(string $duoi): string
    {
        return "/api/shops/{$this->shop->id}/{$duoi}";
    }

    // --- 4.3.3 + 4.4.4 Tiền là số nguyên đồng -----------------------------------

    public function test_gia_mon_luu_thanh_so_nguyen(): void
    {
        $res = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id,
            'name' => 'Cà phê muối',
            'base_price' => 25_500.7,
        ]);

        $res->assertStatus(201);
        $gia = Product::find($res->json('id'))->base_price;
        $this->assertSame(25_501, $gia);
        $this->assertIsInt($gia, 'base_price phải là số nguyên trong CSDL.');
    }

    public function test_gia_size_luu_thanh_so_nguyen(): void
    {
        $res = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id,
            'name' => 'Trà đào',
            'base_price' => 30_000,
            'has_size' => true,
            'sizes' => [
                ['name' => 'M', 'price' => 30_000.4, 'is_active' => true],
                ['name' => 'L', 'price' => 39_999.6, 'is_active' => true],
            ],
        ]);

        $res->assertStatus(201);
        $giaSize = ProductSize::where('product_id', (string) $res->json('id'))->get()
            ->sortBy('size_name')->pluck('price')->values()->all();

        // 39.999,6 làm tròn LÊN thành 40.000; 30.000,4 làm tròn xuống thành 30.000.
        $this->assertSame([40_000, 30_000], [$giaSize[0], $giaSize[1]]);
        $this->assertIsInt($giaSize[0]);
    }

    public function test_gia_topping_luu_thanh_so_nguyen(): void
    {
        $res = $this->postJson($this->url('toppings'), ['name' => 'Trân châu', 'price' => 5_000.5]);

        $res->assertStatus(201);
        $gia = Topping::find($res->json('id'))->price;
        $this->assertSame(5_001, $gia);
        $this->assertIsInt($gia, 'price của topping phải là số nguyên trong CSDL.');
    }

    public function test_sua_gia_topping_cung_lam_tron(): void
    {
        $topping = Topping::create([
            'shop_id' => (string) $this->shop->id, 'name' => 'Thạch', 'price' => 6_000, 'is_available' => true,
        ]);

        $this->putJson($this->url("toppings/{$topping->id}"), ['price' => 7_000.9])->assertStatus(200);
        $this->assertSame(7_001, $topping->fresh()->price);
    }

    /** Topping tặng kèm giá 0 là chuyện có thật — không được coi là thiếu giá. */
    public function test_topping_gia_0_van_them_duoc(): void
    {
        $this->postJson($this->url('toppings'), ['name' => 'Đá thêm', 'price' => 0])
            ->assertStatus(201)
            ->assertJsonPath('price', 0);
    }

    // --- 4.2.3 Danh mục trùng tên -----------------------------------------------

    public function test_khong_them_duoc_danh_muc_trung_ten(): void
    {
        $this->postJson($this->url('categories'), ['name' => 'Cà phê'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Quán đã có danh mục tên "Cà phê".');

        $this->assertSame(1, $this->shop->categories()->count());
    }

    /** "cà phê " với "Cà phê" là cùng một cái tên dưới mắt người dùng. */
    public function test_danh_muc_trung_ten_khong_phan_biet_hoa_thuong_va_khoang_trang(): void
    {
        $this->postJson($this->url('categories'), ['name' => '  cÀ PhÊ '])->assertStatus(422);
    }

    public function test_doi_ten_danh_muc_thanh_ten_da_co_thi_bi_chan(): void
    {
        $khac = Category::create([
            'shop_id' => (string) $this->shop->id, 'name' => 'Trà', 'is_active' => true,
        ]);

        $this->putJson($this->url("categories/{$khac->id}"), ['name' => 'Cà phê'])->assertStatus(422);
        $this->assertSame('Trà', $khac->fresh()->name);
    }

    /** Lưu lại chính nó với tên cũ không được coi là trùng với chính mình. */
    public function test_luu_lai_danh_muc_voi_ten_cu_van_duoc(): void
    {
        $this->putJson($this->url("categories/{$this->category->id}"), ['name' => 'Cà phê', 'description' => 'Đồ nóng'])
            ->assertStatus(200);
    }

    /** Quán khác đặt trùng tên là bình thường — luật chỉ áp trong phạm vi một quán. */
    public function test_quan_khac_van_dat_duoc_ten_danh_muc_giong_nhau(): void
    {
        $quanKhac = $this->user->shops()->create(['name' => 'Quán hai', 'status' => 'open']);
        Subscription::create([
            'shop_id' => (string) $quanKhac->id,
            'package_id' => (string) Package::first()->id,
            'package_name_snapshot' => 'Pro Max',
            'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
            'total_amount' => 199_000, 'status' => 'active',
        ]);

        $this->postJson("/api/shops/{$quanKhac->id}/categories", ['name' => 'Cà phê'])->assertStatus(201);
    }

    // --- 4.5.4 Bàn trùng tên ------------------------------------------------------

    public function test_khong_them_duoc_ban_trung_ten(): void
    {
        $this->postJson($this->url('tables'), ['name' => 'Bàn 5', 'capacity' => 4])->assertStatus(201);

        $this->postJson($this->url('tables'), ['name' => 'bàn 5', 'capacity' => 2])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Quán đã có bàn tên "bàn 5".');

        $this->assertSame(1, $this->shop->tables()->count());
    }

    public function test_doi_ten_ban_thanh_ten_da_co_thi_bi_chan(): void
    {
        $this->postJson($this->url('tables'), ['name' => 'Bàn 1', 'capacity' => 4]);
        $ban2 = $this->postJson($this->url('tables'), ['name' => 'Bàn 2', 'capacity' => 4])->json('id');

        $this->putJson($this->url("tables/{$ban2}"), ['name' => 'Bàn 1'])->assertStatus(422);
    }

    /** Đổi sức chứa mà giữ nguyên tên là thao tác thường ngày, không được chặn. */
    public function test_sua_ban_giu_nguyen_ten_van_duoc(): void
    {
        $ban = $this->postJson($this->url('tables'), ['name' => 'Bàn 3', 'capacity' => 4])->json('id');

        $this->putJson($this->url("tables/{$ban}"), ['name' => 'Bàn 3', 'capacity' => 6])->assertStatus(200);
    }

    // --- 4.3.6 Topping của quán khác ---------------------------------------------

    public function test_khong_gan_duoc_topping_cua_quan_khac_vao_mon(): void
    {
        $quanKhac = $this->user->shops()->create(['name' => 'Quán hai', 'status' => 'open']);
        $toppingLa = Topping::create([
            'shop_id' => (string) $quanKhac->id, 'name' => 'Topping quán khác', 'price' => 5_000, 'is_available' => true,
        ]);

        $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id,
            'name' => 'Món thử',
            'base_price' => 20_000,
            'has_topping' => true,
            'topping_ids' => [(string) $toppingLa->id],
        ])->assertStatus(422)
          ->assertJsonPath('message', 'Có topping không hợp lệ hoặc không thuộc quán của bạn.');
    }

    public function test_gan_duoc_topping_cua_chinh_quan_minh(): void
    {
        $topping = Topping::create([
            'shop_id' => (string) $this->shop->id, 'name' => 'Trân châu', 'price' => 5_000, 'is_available' => true,
        ]);

        $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id,
            'name' => 'Trà sữa',
            'base_price' => 35_000,
            'has_topping' => true,
            'topping_ids' => [(string) $topping->id],
        ])->assertStatus(201)
          ->assertJsonCount(1, 'product_toppings');
    }

    // --- 4.3.1 Món ba size bán đúng giá -------------------------------------------

    public function test_mon_ba_size_ban_dung_gia_tung_size(): void
    {
        $monId = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id,
            'name' => 'Trà đào',
            'base_price' => 30_000,
            'has_size' => true,
            'sizes' => [
                ['name' => 'S', 'price' => 25_000, 'is_active' => true],
                ['name' => 'M', 'price' => 30_000, 'is_active' => true],
                ['name' => 'L', 'price' => 39_000, 'is_active' => true],
            ],
        ])->assertStatus(201)->json('id');

        $sizeL = ProductSize::where('product_id', (string) $monId)->where('size_name', 'L')->first();
        $ban   = $this->shop->tables()->create(['name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty']);

        // Bán 2 ly size L: phải ra 39.000 x 2, không phải giá gốc 30.000 x 2.
        $res = $this->postJson($this->url('orders'), [
            'table_id' => (string) $ban->id,
            'items' => [[
                'product_id' => (string) $monId,
                'product_name_snapshot' => 'Trà đào',
                'product_size_id' => (string) $sizeL->id,
                'size_name_snapshot' => 'L',
                'quantity' => 2,
            ]],
        ]);

        $res->assertStatus(201);
        $this->assertSame(78_000.0, (float) $res->json('subtotal'));
    }

    public function test_khong_dung_duoc_size_cua_mon_khac(): void
    {
        $monA = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id, 'name' => 'Món A', 'base_price' => 20_000,
            'has_size' => true, 'sizes' => [['name' => 'L', 'price' => 90_000, 'is_active' => true]],
        ])->json('id');
        $monB = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id, 'name' => 'Món B', 'base_price' => 20_000,
        ])->json('id');

        $sizeCuaA = ProductSize::where('product_id', (string) $monA)->first();
        $ban = $this->shop->tables()->create(['name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty']);

        $this->postJson($this->url('orders'), [
            'table_id' => (string) $ban->id,
            'items' => [[
                'product_id' => (string) $monB,
                'product_name_snapshot' => 'Món B',
                'product_size_id' => (string) $sizeCuaA->id,
                'quantity' => 1,
            ]],
        ])->assertStatus(422);
    }

    // --- 4.3.4 Ẩn món ---------------------------------------------------------------

    /**
     * Ẩn món KHÔNG được làm hỏng hóa đơn cũ: tên và giá đã chụp lại vào order_details
     * lúc bán, nên hóa đơn in lại sau nhiều tháng vẫn đọc được dù món đã biến mất
     * khỏi thực đơn. Đây là lý do hệ thống không cho xóa cứng món.
     */
    public function test_an_mon_khong_lam_hong_hoa_don_cu(): void
    {
        $monId = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id, 'name' => 'Cà phê mùa hè', 'base_price' => 30_000,
        ])->json('id');
        $ban = $this->shop->tables()->create(['name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty']);

        $donId = $this->postJson($this->url('orders'), [
            'table_id' => (string) $ban->id,
            'items' => [['product_id' => (string) $monId, 'product_name_snapshot' => 'Cà phê mùa hè', 'quantity' => 1]],
        ])->json('id');
        $this->postJson($this->url("orders/{$donId}/pay"), ['payment_method' => 'cash', 'cash_received' => 1_000_000])->assertStatus(200);

        // Hết mùa, chủ quán ẩn món.
        $this->putJson($this->url("products/{$monId}"), ['is_available' => false])->assertStatus(200);

        $don = $this->getJson($this->url("orders/{$donId}"))->json();
        $this->assertSame('Cà phê mùa hè', $don['order_details'][0]['product_name_snapshot']);
        $this->assertSame(30_000.0, (float) $don['total_amount']);
    }

    // --- 4.2.2 Ẩn danh mục ------------------------------------------------------------

    /**
     * QUY TẮC ĐÃ CHỐT: ẩn danh mục = ẩn cả món bên trong khỏi màn hình bán hàng.
     * Chặn ở máy chủ chứ không chỉ lọc lúc hiển thị, vì đơn nháp nằm phía máy chủ:
     * chủ quán có thể tắt danh mục ở tab khác giữa lúc nhân viên đang gọi món.
     */
    public function test_an_danh_muc_thi_mon_ben_trong_khong_ban_duoc(): void
    {
        $monId = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id, 'name' => 'Cà phê đen', 'base_price' => 20_000,
        ])->json('id');
        $ban = $this->shop->tables()->create(['name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty']);

        $this->putJson($this->url("categories/{$this->category->id}"), ['is_active' => false])->assertStatus(200);

        $this->postJson($this->url('orders'), [
            'table_id' => (string) $ban->id,
            'items' => [['product_id' => (string) $monId, 'product_name_snapshot' => 'Cà phê đen', 'quantity' => 1]],
        ])->assertStatus(422)
          ->assertJsonPath('message', 'Danh mục "Cà phê" đang ẩn nên món "Cà phê đen" không bán được.');
    }

    /** Ẩn rồi bật lại danh mục thì mọi thứ trở về đúng như cũ — không đụng vào từng món. */
    public function test_bat_lai_danh_muc_thi_mon_ban_duoc_tro_lai(): void
    {
        $monId = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id, 'name' => 'Cà phê đen', 'base_price' => 20_000,
        ])->json('id');
        $ban = $this->shop->tables()->create(['name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty']);

        $this->putJson($this->url("categories/{$this->category->id}"), ['is_active' => false]);
        $this->putJson($this->url("categories/{$this->category->id}"), ['is_active' => true]);

        $this->assertNotFalse(Product::find($monId)->is_available, 'Ẩn danh mục không được sửa is_available của từng món.');
        $this->postJson($this->url('orders'), [
            'table_id' => (string) $ban->id,
            'items' => [['product_id' => (string) $monId, 'product_name_snapshot' => 'Cà phê đen', 'quantity' => 1]],
        ])->assertStatus(201);
    }

    // --- 4.4.2 Ẩn topping đang gắn cho món ----------------------------------------------

    /** Ẩn topping KHÔNG được kéo theo món: khách vẫn gọi được ly trà sữa, chỉ là không thêm trân châu. */
    public function test_an_topping_thi_mon_van_ban_duoc_nhung_topping_do_thi_khong(): void
    {
        $topping = Topping::create([
            'shop_id' => (string) $this->shop->id, 'name' => 'Trân châu', 'price' => 5_000, 'is_available' => true,
        ]);
        $monId = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id, 'name' => 'Trà sữa', 'base_price' => 35_000,
            'has_topping' => true, 'topping_ids' => [(string) $topping->id],
        ])->json('id');
        $ban = $this->shop->tables()->create(['name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty']);

        $topping->update(['is_available' => false]);

        // Gọi kèm topping đã ẩn -> bị chặn.
        $this->postJson($this->url('orders'), [
            'table_id' => (string) $ban->id,
            'items' => [[
                'product_id' => (string) $monId, 'product_name_snapshot' => 'Trà sữa', 'quantity' => 1,
                'toppings' => [['topping_id' => (string) $topping->id, 'quantity' => 1]],
            ]],
        ])->assertStatus(422)
          ->assertJsonPath('message', 'Topping "Trân châu" đã ngừng bán, vui lòng bỏ khỏi đơn.');

        // Gọi món trơn -> vẫn bán bình thường.
        $this->postJson($this->url('orders'), [
            'table_id' => (string) $ban->id,
            'items' => [['product_id' => (string) $monId, 'product_name_snapshot' => 'Trà sữa', 'quantity' => 1]],
        ])->assertStatus(201);
    }

    public function test_mon_da_an_khong_ban_duoc_nua(): void
    {
        $monId = $this->postJson($this->url('products'), [
            'category_id' => (string) $this->category->id, 'name' => 'Món hết hàng', 'base_price' => 30_000,
        ])->json('id');
        $this->putJson($this->url("products/{$monId}"), ['is_available' => false]);

        $ban = $this->shop->tables()->create(['name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty']);
        $this->postJson($this->url('orders'), [
            'table_id' => (string) $ban->id,
            'items' => [['product_id' => (string) $monId, 'product_name_snapshot' => 'Món hết hàng', 'quantity' => 1]],
        ])->assertStatus(422);
    }
}
