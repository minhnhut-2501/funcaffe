<?php

namespace Tests\Feature;

use App\Models\Cafe;
use App\Models\Category;
use App\Models\Package;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Hạn mức theo gói dịch vụ — thứ phân biệt gói trả tiền với gói không trả tiền.
 *
 * Điều đang được bảo vệ: hạn mức phải chặn ở MÁY CHỦ. Giao diện có ẩn nút, có đếm
 * "15/15 món" thì cũng chỉ là lịch sự — ai mở công cụ nhà phát triển và gọi thẳng
 * API cũng phải bị từ chối như thường.
 */
class PackageLimitTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'cafes', 'packages', 'subscriptions', 'categories', 'items', 'item_prices', 'tables',
    ];

    private User $user;
    private Cafe $cafe;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Chủ quán kiểm thử hạn mức',
            'email' => 'limit-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);

        $this->cafe = $this->user->cafes()->create(['name' => 'Quán kiểm thử hạn mức', 'status' => 'open']);

        Sanctum::actingAs($this->user);
    }

    /**
     * Gắn một gói cho quán. `$maxTables` / `$maxItems` để null nghĩa là không giới hạn.
     * `$expired` dựng cảnh gói đã hết hạn nhưng document vẫn còn status 'active'.
     */
    private function givePackage(?int $maxTables, ?int $maxItems, bool $expired = false): Package
    {
        $package = Package::create([
            'name' => $maxTables === null ? 'Pro Max' : 'Pro',
            'type' => $maxTables === null ? 'promax' : 'pro',
            'level' => $maxTables === null ? 2 : 1,
            'status' => 'active',
            'is_trial' => false,
            'can_use_ai' => $maxTables === null,
            'max_tables' => $maxTables,
            'max_menu_items' => $maxItems,
        ]);

        Subscription::create([
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $package->id,
            'package_name_snapshot' => $package->name,
            'start_date' => now()->subMonth(),
            'end_date' => $expired ? now()->subDay() : now()->addMonth(),
            'total_amount' => 199_000,
            'status' => 'active',
        ]);

        return $package;
    }

    private function createTables(int $count): void
    {
        for ($i = 1; $i <= $count; $i++) {
            $this->cafe->tables()->create(['name' => "Bàn {$i}", 'capacity' => 4, 'status' => 'empty']);
        }
    }

    private function createItems(int $count, int $hidden = 0): void
    {
        $category = Category::create([
            'cafe_id' => (string) $this->cafe->id, 'name' => 'Cà phê', 'is_active' => true,
        ]);

        for ($i = 1; $i <= $count; $i++) {
            $this->cafe->items()->create([
                'category_id' => (string) $category->id,
                'name' => "Món {$i}",
                'base_price' => 25_000,
                'is_available' => $i > $hidden,
            ]);
        }
    }

    private function postTable(string $name = 'Bàn thêm')
    {
        return $this->postJson("/api/cafes/{$this->cafe->id}/tables", [
            'name' => $name, 'capacity' => 4,
        ]);
    }

    private function postItem(string $name = 'Món thêm')
    {
        $category = Category::where('cafe_id', (string) $this->cafe->id)->first()
            ?? Category::create(['cafe_id' => (string) $this->cafe->id, 'name' => 'Cà phê', 'is_active' => true]);
        $categoryId = (string) $category->id;

        return $this->postJson("/api/cafes/{$this->cafe->id}/items", [
            'category_id' => $categoryId, 'name' => $name, 'base_price' => 30_000,
        ]);
    }

    public function test_goi_pro_chan_ban_vuot_han_muc(): void
    {
        $this->givePackage(maxTables: 10, maxItems: 15);
        $this->createTables(10);

        $this->postTable()
            ->assertStatus(422)
            ->assertJsonPath('message', 'Gói Pro chỉ cho phép tối đa 10 bàn. Nâng cấp gói để dùng nhiều hơn.');

        $this->assertSame(10, $this->cafe->tables()->count(), 'Bàn thứ 11 không được ghi vào CSDL.');
    }

    public function test_goi_pro_cho_them_ban_khi_chua_cham_tran(): void
    {
        $this->givePackage(maxTables: 10, maxItems: 15);
        $this->createTables(9);

        $this->postTable()->assertStatus(201);
        $this->assertSame(10, $this->cafe->tables()->count());
    }

    public function test_goi_pro_chan_mon_vuot_han_muc(): void
    {
        $this->givePackage(maxTables: 10, maxItems: 15);
        $this->createItems(15);

        $this->postItem()
            ->assertStatus(422)
            ->assertJsonPath('message', 'Gói Pro chỉ cho phép tối đa 15 món. Nâng cấp gói để dùng nhiều hơn.');

        $this->assertSame(15, $this->cafe->items()->count());
    }

    /**
     * Món ẩn VẪN chiếm suất. Đây là quy tắc đang chạy, không phải sự cố: món không
     * xóa được (hóa đơn cũ còn trỏ tới), nên nếu ẩn đi mà được thêm món mới thì chỉ
     * cần ẩn-hiện luân phiên là vượt hạn mức bao nhiêu cũng được.
     */
    public function test_mon_da_an_van_chiem_suat_trong_han_muc(): void
    {
        $this->givePackage(maxTables: 10, maxItems: 15);
        $this->createItems(15, hidden: 5);

        $this->postItem()->assertStatus(422);
    }

    public function test_goi_pro_max_khong_gioi_han_ban_va_mon(): void
    {
        $this->givePackage(maxTables: null, maxItems: null);
        $this->createTables(30);
        $this->createItems(40);

        $this->postTable()->assertStatus(201);
        $this->postItem()->assertStatus(201);
    }

    /**
     * Hết hạn = CHỈ XEM. Không phải "hạ về gói miễn phí", cũng không phải "khóa hẳn":
     * đọc vẫn được, ghi thì không.
     */
    public function test_goi_het_han_chan_moi_thao_tac_ghi(): void
    {
        $this->givePackage(maxTables: 10, maxItems: 15, expired: true);

        $this->postTable()
            ->assertStatus(403)
            ->assertJsonPath('message', 'Quán này cần kích hoạt gói dịch vụ để sử dụng chức năng này.');

        $this->getJson("/api/cafes/{$this->cafe->id}/tables")->assertStatus(200);
    }

    public function test_quan_khong_co_goi_khong_ghi_duoc_gi(): void
    {
        $this->postTable()->assertStatus(403);
        $this->postItem()->assertStatus(403);
    }
}
