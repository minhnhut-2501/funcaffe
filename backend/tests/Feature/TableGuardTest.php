<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\Order;
use App\Models\Package;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Bàn là thứ DUY NHẤT trong hệ thống còn xóa cứng được (món, topping, danh mục chỉ ẩn).
 *
 * Điều đang được bảo vệ: xóa một cái bàn đang có khách ngồi sẽ bỏ rơi đơn hàng của
 * họ — đơn còn đó nhưng không còn bàn nào trỏ tới, tiền không ai thu.
 */
class TableGuardTest extends MongoTestCase
{
    protected array $collections = ['users', 'shops', 'packages', 'subscriptions', 'tables', 'orders'];

    private User $user;
    private Shop $shop;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Chủ quán kiểm thử bàn',
            'email' => 'table-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $this->shop = $this->user->shops()->create(['name' => 'Quán kiểm thử bàn', 'status' => 'open']);

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

        Sanctum::actingAs($this->user);
    }

    private function taoBan(string $ten = 'Bàn 1')
    {
        return $this->shop->tables()->create(['name' => $ten, 'capacity' => 4, 'status' => 'empty']);
    }

    private function taoDon($table, string $status)
    {
        return Order::create([
            'shop_id' => (string) $this->shop->id,
            'table_id' => (string) $table->id,
            'code' => 'ORD-' . uniqid(),
            'status' => $status,
            'subtotal' => 50_000,
            'total_amount' => 50_000,
        ]);
    }

    public function test_khong_xoa_duoc_ban_dang_co_don_chua_thanh_toan(): void
    {
        $table = $this->taoBan();
        $this->taoDon($table, 'active');

        $this->deleteJson("/api/shops/{$this->shop->id}/tables/{$table->id}")
            ->assertStatus(400)
            ->assertJsonPath('message', 'Không thể xóa bàn đang có order chưa thanh toán');

        $this->assertSame(1, $this->shop->tables()->count(), 'Bàn phải còn nguyên.');
    }

    public function test_xoa_duoc_ban_trong(): void
    {
        $table = $this->taoBan();

        $this->deleteJson("/api/shops/{$this->shop->id}/tables/{$table->id}")->assertStatus(200);
        $this->assertSame(0, $this->shop->tables()->count());
    }

    /** Đơn đã thanh toán xong thì bàn trống trở lại — không có lý do gì giữ nó lại. */
    public function test_xoa_duoc_ban_chi_con_don_da_thanh_toan(): void
    {
        $table = $this->taoBan();
        $this->taoDon($table, 'paid');

        $this->deleteJson("/api/shops/{$this->shop->id}/tables/{$table->id}")->assertStatus(200);
        $this->assertSame(0, $this->shop->tables()->count());
    }

    public function test_khong_dong_duoc_vao_ban_cua_quan_nguoi_khac(): void
    {
        $nguoiKhac = User::create([
            'full_name' => 'Chủ quán khác',
            'email' => 'khac-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $quanKhac = $nguoiKhac->shops()->create(['name' => 'Quán của người khác', 'status' => 'open']);
        $banCuaHo = $quanKhac->tables()->create(['name' => 'Bàn A', 'capacity' => 2, 'status' => 'empty']);

        // Vẫn đang đăng nhập bằng tài khoản ban đầu.
        $this->deleteJson("/api/shops/{$quanKhac->id}/tables/{$banCuaHo->id}")->assertStatus(403);
        $this->assertSame(1, $quanKhac->tables()->count(), 'Bàn của người khác phải còn nguyên.');
    }
}
