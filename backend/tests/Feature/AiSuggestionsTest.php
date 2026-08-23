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
 * Câu gợi ý mở đầu của trợ lý AI.
 *
 * Điều thật sự cần bảo vệ: gợi ý và ngữ cảnh gửi cho Gemini phải cùng một nguồn.
 * Trước đây frontend ghi cứng câu "Quán tôi có bao nhiêu bàn?" trong khi ngữ cảnh
 * KHÔNG hề chứa số liệu bàn — bấm vào là AI đoán bừa. Sinh gợi ý ở backend chỉ có
 * nghĩa nếu nó đọc đúng trạng thái quán, nên đó là thứ được kiểm ở đây.
 *
 * Số bàn đang phục vụ phải đếm từ ĐƠN ĐANG MỞ chứ không từ `tables.status` — trường
 * đó là bộ nhớ đệm và có thể lệch (Mongo standalone không có transaction).
 */
class AiSuggestionsTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'shops', 'packages', 'subscriptions', 'categories',
        'products', 'tables', 'orders', 'order_details',
    ];

    private User $user;
    private Shop $shop;
    private Product $product;
    private $table;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Chủ quán kiểm thử',
            'email' => 'ai-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);

        $this->shop = $this->user->shops()->create(['name' => 'Quán kiểm thử', 'status' => 'open']);

        // Gói phải bật can_use_ai, nếu không middleware 'ai' chặn ở 403.
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

        $this->table = $this->shop->tables()->create([
            'name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty',
        ]);

        Sanctum::actingAs($this->user);
    }

    private function fetch(): array
    {
        $res = $this->getJson("/api/shops/{$this->shop->id}/ai/suggestions");
        $res->assertStatus(200);
        return $res->json('suggestions');
    }

    private function openOrder(): void
    {
        $this->postJson("/api/shops/{$this->shop->id}/orders", [
            'table_id' => (string) $this->table->id,
            'items' => [[
                'product_id' => (string) $this->item->id,
                'product_name_snapshot' => 'Cà phê sữa',
                'quantity' => 1,
            ]],
        ])->assertStatus(201);
    }

    public function test_luon_tra_ve_toi_da_ba_cau_va_khong_bao_gio_rong(): void
    {
        // Quán mới tinh: chưa có đơn nào, chưa bán được gì. Vẫn phải có câu để bấm.
        $suggestions = $this->fetch();

        $this->assertNotEmpty($suggestions);
        $this->assertLessThanOrEqual(3, count($suggestions));
    }

    public function test_khong_moi_hoi_ve_ban_khi_khong_co_ban_nao_dang_phuc_vu(): void
    {
        $joined = implode(' | ', $this->fetch());

        $this->assertStringNotContainsString('đang phục vụ, mấy bàn trống', $joined);
    }

    public function test_moi_hoi_ve_ban_khi_co_don_dang_mo(): void
    {
        $this->openOrder();

        $this->assertStringContainsString(
            'Hiện có mấy bàn đang phục vụ, mấy bàn trống?',
            implode(' | ', $this->fetch()),
        );
    }

    public function test_don_da_huy_thi_khong_con_tinh_la_ban_dang_phuc_vu(): void
    {
        $this->openOrder();

        // Mô phỏng đúng ca lệnh ghi thứ hai bị hỏng: đơn đã đóng nhưng `tables.status`
        // còn kẹt ở 'serving'. Gợi ý phải đi theo ĐƠN, không theo bàn.
        Order::where('shop_id', (string) $this->shop->id)->update(['status' => 'cancelled']);
        $this->table->update(['status' => 'serving']);

        $this->assertStringNotContainsString(
            'đang phục vụ, mấy bàn trống',
            implode(' | ', $this->fetch()),
            'Bàn chỉ được tính là đang phục vụ khi thật sự còn đơn mở',
        );
    }

    public function test_goi_hoi_mon_ban_chay_sau_khi_da_co_doanh_thu(): void
    {
        $this->openOrder();
        $orderId = Order::where('shop_id', (string) $this->shop->id)->first()->id;
        $this->postJson("/api/shops/{$this->shop->id}/orders/{$orderId}/pay", [
            'payment_method' => 'cash',
            // Bắt buộc từ khi tiền mặt phải ghi số khách đưa; bài này không soi tiền thối.
            'cash_received' => 1_000_000,
        ])->assertStatus(200);

        $this->assertStringContainsString(
            'bán chạy nhất',
            implode(' | ', $this->fetch()),
        );
    }

    public function test_goi_bi_chan_khi_khong_co_quyen_dung_ai(): void
    {
        Package::query()->update(['can_use_ai' => false]);

        $this->getJson("/api/shops/{$this->shop->id}/ai/suggestions")->assertStatus(403);
    }

    /**
     * Việc 5.6.1: MỌI đường AI đều phải khóa, không riêng đường gợi ý.
     *
     * Đi qua bảng route thật thay vì liệt kê tay — thêm một endpoint AI mới mà quên
     * gắn middleware thì bài này đỏ ngay, không cần ai nhớ cập nhật danh sách.
     * Nút ở giao diện chỉ để cho đẹp; chốt chặn thật nằm ở đây.
     */
    public function test_moi_duong_ai_deu_bi_chan_khi_goi_khong_cho_dung_ai(): void
    {
        Package::query()->update(['can_use_ai' => false]);

        $duongAi = collect(\Illuminate\Support\Facades\Route::getRoutes())->filter(function ($r) {
            $mw = $r->gatherMiddleware();
            return (in_array('ai', $mw, true) || in_array(\App\Http\Middleware\RequiresAI::class, $mw, true))
                && str_contains($r->uri(), '/ai/');
        });

        $this->assertGreaterThanOrEqual(4, $duongAi->count(),
            'Số đường AI ít bất thường — có thể ai đó vừa gỡ middleware.');

        $lot = [];
        foreach ($duongAi as $route) {
            $duong = '/' . ltrim(str_replace('{shop}', (string) $this->shop->id, $route->uri()), '/');
            $cach = collect($route->methods())->first(fn ($m) => !in_array($m, ['HEAD', 'OPTIONS'], true));
            $res = $this->json($cach, $duong, ['message' => 'xin chào']);
            if ($res->getStatusCode() !== 403) {
                $lot[] = "{$cach} {$route->uri()} -> {$res->getStatusCode()}";
            }
        }

        $this->assertSame([], $lot, "Đường AI gọi được bằng gói không có quyền:\n" . implode("\n", $lot));
    }

    /** Gói có quyền nhưng ĐÃ HẾT HẠN cũng không được dùng AI. */
    public function test_goi_het_han_thi_khong_dung_duoc_ai_du_goi_do_co_quyen(): void
    {
        Subscription::where('shop_id', (string) $this->shop->id)
            ->update(['end_date' => now()->subDay()]);

        $this->getJson("/api/shops/{$this->shop->id}/ai/suggestions")->assertStatus(403);
    }
}
