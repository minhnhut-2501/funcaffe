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
 * Bàn nay chỉ ẨN chứ không xóa — thống nhất với món, topping, danh mục và quán.
 *
 * Xóa cứng một cái bàn là bỏ rơi mọi hóa đơn cũ từng gắn với nó: `orders.table_id` trỏ
 * vào document không còn tồn tại, cột Bàn ở bảng Hóa đơn trống trơn cho những đơn đã
 * bán xong từ lâu. Còn ẩn một cái bàn ĐANG CÓ KHÁCH thì làm mất lối thu tiền của chính
 * đơn đang mở — bàn biến khỏi màn Bán hàng trong khi đơn vẫn còn đó.
 *
 * Bài kiểm ở đây khóa cả hai điều đó lại, cộng thêm hai điều nữa: đường xóa phải thật
 * sự không còn, và `status` không được sửa qua API (nó là giá trị DẪN XUẤT từ đơn đang
 * mở, xem `tablesLive` ở màn Bán hàng).
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

    public function test_khong_an_duoc_ban_dang_co_don_chua_thanh_toan(): void
    {
        $table = $this->taoBan();
        $this->taoDon($table, 'active');

        $this->putJson("/api/shops/{$this->shop->id}/tables/{$table->id}", ['is_active' => false])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Bàn đang có đơn chưa thanh toán, không ẩn được. Thanh toán hoặc hủy đơn trước đã.');

        $this->assertNotFalse($table->fresh()->is_active, 'Bàn phải còn đang dùng.');
    }

    public function test_an_duoc_ban_trong(): void
    {
        $table = $this->taoBan();

        $this->putJson("/api/shops/{$this->shop->id}/tables/{$table->id}", ['is_active' => false])
            ->assertStatus(200);

        $this->assertFalse($table->fresh()->is_active);
        // Ẩn KHÁC xóa: bản ghi phải còn nguyên để hóa đơn cũ vẫn tra được tên bàn.
        $this->assertSame(1, $this->shop->tables()->count());
    }

    /** Đơn đã thanh toán xong thì bàn trống trở lại — không có lý do gì cấm ẩn. */
    public function test_an_duoc_ban_chi_con_don_da_thanh_toan(): void
    {
        $table = $this->taoBan();
        $this->taoDon($table, 'paid');

        $this->putJson("/api/shops/{$this->shop->id}/tables/{$table->id}", ['is_active' => false])
            ->assertStatus(200);
        $this->assertFalse($table->fresh()->is_active);
    }

    public function test_hien_lai_duoc_ban_da_an(): void
    {
        $table = $this->taoBan();
        $this->putJson("/api/shops/{$this->shop->id}/tables/{$table->id}", ['is_active' => false]);

        $this->putJson("/api/shops/{$this->shop->id}/tables/{$table->id}", ['is_active' => true])
            ->assertStatus(200);
        $this->assertTrue($table->fresh()->is_active);
    }

    /**
     * Đường xóa phải THẬT SỰ không còn, không chỉ là ẩn nút ở giao diện.
     * Gỡ nút mà để nguyên route thì ai gọi thẳng API vẫn xóa được bàn.
     */
    public function test_khong_con_duong_xoa_ban(): void
    {
        $table = $this->taoBan();

        $this->deleteJson("/api/shops/{$this->shop->id}/tables/{$table->id}")->assertStatus(405);
        $this->assertSame(1, $this->shop->tables()->count());
    }

    /**
     * `status` là giá trị DẪN XUẤT từ đơn đang mở, không phải thứ chủ quán đặt tay.
     * Trước đây API nhận nó, nên sửa xong màn Bán hàng vẫn hiện khác — một lời hứa suông.
     */
    public function test_khong_dat_duoc_trang_thai_ban_qua_api(): void
    {
        $table = $this->taoBan();

        $this->putJson("/api/shops/{$this->shop->id}/tables/{$table->id}", ['status' => 'serving'])
            ->assertStatus(200);
        $this->assertSame('empty', $table->fresh()->status, 'status gửi lên phải bị bỏ qua.');

        // Cả lúc tạo mới cũng vậy.
        $this->postJson("/api/shops/{$this->shop->id}/tables", [
            'name' => 'Bàn mới', 'capacity' => 4, 'status' => 'serving',
        ])->assertStatus(201)->assertJsonPath('status', 'empty');
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
        $this->putJson("/api/shops/{$quanKhac->id}/tables/{$banCuaHo->id}", ['is_active' => false])
            ->assertStatus(403);
        $this->assertNotFalse($banCuaHo->fresh()->is_active, 'Bàn của người khác phải còn nguyên.');
    }
}
