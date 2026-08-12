<?php

namespace Tests\Feature;

use App\Models\Cafe;
use App\Models\Package;
use App\Models\Review;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Đánh giá phần mềm — thứ DUY NHẤT trong hệ thống hiện ra ngoài trang công khai
 * kèm tên người thật.
 *
 * Hai điều đang được giữ:
 *  1. Mỗi tài khoản đúng MỘT đánh giá (gửi lần hai là SỬA, không đẻ thêm bản ghi).
 *  2. Trang công khai chỉ nhận đúng những trường cần để hiển thị — không nhúng
 *     nguyên đối tượng người dùng, vì trong đó có email, số điện thoại và mã đặt
 *     lại mật khẩu.
 */
class ReviewRulesTest extends MongoTestCase
{
    protected array $collections = ['users', 'cafes', 'packages', 'subscriptions', 'reviews'];

    private User $user;
    private Cafe $cafe;
    private Package $goi;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Nguyễn Văn Đánh Giá',
            'email' => 'review-' . uniqid() . '@funcafe.test',
            'phone' => '0900111222',
            'password' => Hash::make('Password@123'),
            'role' => 'user', 'status' => 'active',
            'reset_token' => 'BI-MAT-KHONG-DUOC-LO',
        ]);
        $this->cafe = $this->user->cafes()->create(['name' => 'Quán đánh giá', 'status' => 'open']);

        $this->goi = Package::create([
            'name' => 'Pro Max', 'type' => 'promax', 'level' => 2,
            'status' => 'active', 'is_trial' => false, 'can_use_ai' => true,
        ]);
        Subscription::create([
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $this->goi->id,
            'package_name_snapshot' => 'Pro Max',
            'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
            'total_amount' => 199_000, 'status' => 'active',
        ]);

        Sanctum::actingAs($this->user);
    }

    private function gui(array $doiLai = [])
    {
        return $this->postJson("/api/cafes/{$this->cafe->id}/reviews", array_merge([
            'rating' => 5, 'title' => 'Rất hài lòng', 'comment' => 'Phần mềm dễ dùng.',
        ], $doiLai));
    }

    // === 5.7.1 Mỗi tài khoản một đánh giá ==========================================

    public function test_gui_hai_lan_van_chi_mot_ban_ghi(): void
    {
        $this->gui()->assertStatus(201);
        $this->gui(['rating' => 3, 'title' => 'Nghĩ lại thì', 'comment' => 'Còn vài chỗ khó dùng.'])
            ->assertStatus(200);

        $this->assertSame(1, Review::where('user_id', (string) $this->user->id)->count(),
            'Gửi lần hai đẻ thêm một bản ghi thay vì sửa bản cũ.');
    }

    public function test_gui_lan_hai_la_SUA_noi_dung_cu(): void
    {
        $this->gui();
        $this->gui(['rating' => 3, 'title' => 'Nghĩ lại thì', 'comment' => 'Còn vài chỗ khó dùng.']);

        $dg = Review::where('user_id', (string) $this->user->id)->first();
        $this->assertSame(3, (int) $dg->rating);
        $this->assertSame('Nghĩ lại thì', $dg->title);
    }

    /** Đánh giá là về PHẦN MỀM, không về từng quán: có hai quán vẫn chỉ một đánh giá. */
    public function test_co_hai_quan_van_chi_mot_danh_gia(): void
    {
        $quanHai = $this->user->cafes()->create(['name' => 'Quán thứ hai', 'status' => 'open']);
        Subscription::create([
            'cafe_id' => (string) $quanHai->id, 'package_id' => (string) $this->goi->id,
            'package_name_snapshot' => 'Pro Max',
            'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
            'total_amount' => 199_000, 'status' => 'active',
        ]);

        $this->gui();
        $this->postJson("/api/cafes/{$quanHai->id}/reviews", [
            'rating' => 4, 'title' => 'Quán hai', 'comment' => 'Vẫn tốt.',
        ]);

        $this->assertSame(1, Review::where('user_id', (string) $this->user->id)->count());
    }

    // === 5.7.3 Không lộ thông tin cá nhân ==========================================

    /**
     * Trang chủ ai cũng xem được, kể cả người không đăng nhập. Nhúng nguyên đối tượng
     * người dùng vào đó là công khai email, số điện thoại và mã đặt lại mật khẩu của
     * chính khách hàng — một dòng `->with('user')` bất cẩn là đủ.
     */
    public function test_danh_gia_cong_khai_khong_lo_thong_tin_ca_nhan(): void
    {
        $this->gui();

        // Gọi KHÔNG kèm token, đúng như trình duyệt của người lạ.
        $than = $this->getJson('/api/reviews')->assertStatus(200)->json();
        $chuoi = json_encode($than, JSON_UNESCAPED_UNICODE);

        $this->assertStringNotContainsString($this->user->email, $chuoi, 'Lộ email người viết.');
        $this->assertStringNotContainsString('0900111222', $chuoi, 'Lộ số điện thoại người viết.');
        $this->assertStringNotContainsString('BI-MAT-KHONG-DUOC-LO', $chuoi, 'Lộ mã đặt lại mật khẩu.');
        $this->assertStringNotContainsString('password', $chuoi);

        // Và vẫn đủ thứ CẦN để hiển thị.
        $this->assertSame('Nguyễn Văn Đánh Giá', $than[0]['user_name']);
        $this->assertSame(5, (int) $than[0]['rating']);
    }

    /** Danh sách trường trả ra phải là danh sách TRẮNG, không phải "bỏ bớt vài trường". */
    public function test_danh_gia_cong_khai_chi_tra_dung_cac_truong_da_chot(): void
    {
        $this->gui();

        $mot = $this->getJson('/api/reviews')->json()[0];

        $this->assertEqualsCanonicalizing(
            ['id', 'rating', 'title', 'comment', 'created_at', 'user_name', 'avatar', 'cafe_name', 'package_name'],
            array_keys($mot),
            'Có trường lạ lọt ra trang công khai — kiểm lại publicReviews().',
        );
    }

    // === 5.7.4 Đánh giá bị ẩn ======================================================

    public function test_danh_gia_bi_an_khong_lot_ra_trang_chu(): void
    {
        $this->gui();
        $dg = Review::where('user_id', (string) $this->user->id)->first();
        $dg->update(['status' => 'hidden']);

        $than = $this->getJson('/api/reviews')->assertStatus(200)->json();

        $this->assertCount(0, $than, 'Đánh giá đã ẩn vẫn hiện trên trang chủ.');
    }

    public function test_hien_lai_thi_quay_ve_trang_chu(): void
    {
        $this->gui();
        $dg = Review::where('user_id', (string) $this->user->id)->first();
        $dg->update(['status' => 'hidden']);
        $dg->update(['status' => 'visible']);

        $this->assertCount(1, $this->getJson('/api/reviews')->json());
    }

    /** Đánh giá của người dùng bị ẩn vẫn đọc lại được ở "đánh giá của tôi". */
    public function test_nguoi_viet_van_xem_lai_duoc_danh_gia_da_bi_an(): void
    {
        $this->gui();
        Review::where('user_id', (string) $this->user->id)->first()->update(['status' => 'hidden']);

        $this->getJson('/api/reviews/mine')->assertStatus(200)->assertJsonPath('rating', 5);
    }
}
