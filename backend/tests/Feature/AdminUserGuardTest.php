<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Ranh giới giữa tài khoản quản trị và tài khoản khách hàng ở màn hình Quản lý người dùng.
 *
 * Trước đây danh sách trả về MỌI tài khoản, kể cả admin, và nút khóa chỉ chặn đúng
 * một trường hợp là admin tự khóa chính mình. Hệ thống lúc đó có duy nhất một admin
 * nên không ai gặp sự cố — nhưng đó là may, không phải thiết kế: thêm admin thứ hai
 * là admin này khóa được admin kia, tự đóng cửa hệ thống.
 *
 * Hai điều được giữ ở đây: danh sách chỉ gồm chủ quán, và không khóa được BẤT KỲ
 * tài khoản quản trị nào.
 */
class AdminUserGuardTest extends MongoTestCase
{
    // Khóa tài khoản kéo theo thu hồi token, mà token nằm ở SQLite chứ không ở Mongo.
    // Không dựng lược đồ SQLite thì lệnh xóa token báo "no such table".
    use RefreshDatabase;

    protected array $collections = ['users', 'shops', 'subscriptions', 'package_payments'];

    private User $admin;
    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'full_name' => 'Quản trị viên',
            'email' => 'admin-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->owner = User::create([
            'full_name' => 'Chủ quán',
            'email' => 'owner-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
    }

    public function test_danh_sach_nguoi_dung_khong_chua_tai_khoan_quan_tri(): void
    {
        Sanctum::actingAs($this->admin);

        $res = $this->getJson('/api/admin/users');
        $res->assertStatus(200);

        $emails = collect($res->json('data'))->pluck('email')->all();

        $this->assertContains($this->owner->email, $emails, 'Chủ quán phải có trong danh sách.');
        $this->assertNotContains($this->admin->email, $emails, 'Tài khoản quản trị không được lọt vào danh sách khách hàng.');
    }

    public function test_khong_khoa_duoc_tai_khoan_quan_tri_khac(): void
    {
        $other = User::create([
            'full_name' => 'Quản trị viên khác',
            'email' => 'admin2-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        Sanctum::actingAs($this->admin);

        $this->putJson("/api/admin/users/{$other->id}/lock")->assertStatus(403);

        $this->assertSame('active', $other->fresh()->status, 'Tài khoản quản trị vẫn phải mở sau khi bị từ chối.');
    }

    public function test_khong_tu_khoa_duoc_chinh_minh(): void
    {
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/admin/users/{$this->admin->id}/lock")->assertStatus(403);

        $this->assertSame('active', $this->admin->fresh()->status);
    }

    public function test_van_khoa_va_mo_khoa_duoc_tai_khoan_chu_quan(): void
    {
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/admin/users/{$this->owner->id}/lock")->assertStatus(200);
        $this->assertSame('locked', $this->owner->fresh()->status);

        $this->putJson("/api/admin/users/{$this->owner->id}/lock")->assertStatus(200);
        $this->assertSame('active', $this->owner->fresh()->status);
    }
}
