<?php

namespace Tests\Feature;

use App\Models\Cafe;
use App\Models\Category;
use App\Models\Item;
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
        'users', 'cafes', 'packages', 'subscriptions', 'categories',
        'items', 'tables', 'orders', 'order_details',
    ];

    private User $user;
    private Cafe $cafe;
    private Item $item;
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

        $this->cafe = $this->user->cafes()->create(['name' => 'Quán kiểm thử', 'status' => 'open']);

        // Gói phải bật can_use_ai, nếu không middleware 'ai' chặn ở 403.
        $package = Package::create([
            'name' => 'Pro Max', 'type' => 'promax', 'level' => 2,
            'status' => 'active', 'is_trial' => false, 'can_use_ai' => true,
        ]);

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
        ]);

        $this->table = $this->cafe->tables()->create([
            'name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty',
        ]);

        Sanctum::actingAs($this->user);
    }

    private function fetch(): array
    {
        $res = $this->getJson("/api/cafes/{$this->cafe->id}/ai/suggestions");
        $res->assertStatus(200);
        return $res->json('suggestions');
    }

    private function openOrder(): void
    {
        $this->postJson("/api/cafes/{$this->cafe->id}/orders", [
            'table_id' => (string) $this->table->id,
            'items' => [[
                'item_id' => (string) $this->item->id,
                'item_name_snapshot' => 'Cà phê sữa',
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
        Order::where('cafe_id', (string) $this->cafe->id)->update(['status' => 'cancelled']);
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
        $orderId = Order::where('cafe_id', (string) $this->cafe->id)->first()->id;
        $this->postJson("/api/cafes/{$this->cafe->id}/orders/{$orderId}/pay", [
            'payment_method' => 'cash',
        ])->assertStatus(200);

        $this->assertStringContainsString(
            'bán chạy nhất',
            implode(' | ', $this->fetch()),
        );
    }

    public function test_goi_bi_chan_khi_khong_co_quyen_dung_ai(): void
    {
        Package::query()->update(['can_use_ai' => false]);

        $this->getJson("/api/cafes/{$this->cafe->id}/ai/suggestions")->assertStatus(403);
    }
}
