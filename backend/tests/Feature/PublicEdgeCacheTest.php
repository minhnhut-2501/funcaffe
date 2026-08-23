<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\Package;
use App\Models\TimeSubscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Ranh giới của PublicEdgeCache: đường nào được biên đệm chung, đường nào tuyệt đối không.
 *
 * Đây là bài kiểm thử về BẢO MẬT nhiều hơn về tốc độ. Bộ đệm của Cloudflare dùng chung
 * cho mọi khách: một phản hồi lọt vào đó là mọi người sẽ nhận đúng nội dung ấy cho tới
 * khi hết hạn, bất kể họ là ai. Nên thứ phải khoá chặt là DANH SÁCH đường được đệm —
 * thêm nhầm một đường có dữ liệu riêng của quán là quán này thấy số liệu của quán kia.
 *
 * Bài `..._van_giu_cors_chat` là cặp đối chứng: không có nó thì các bài trên vẫn xanh
 * ngay cả khi middleware lỡ nới cho TOÀN BỘ /api, tức là xanh giả.
 */
class PublicEdgeCacheTest extends MongoTestCase
{
    protected array $collections = ['users', 'shops', 'packages', 'time_subscriptions'];

    private function taoGoi(): Package
    {
        return Package::create([
            'name' => 'Pro',
            'price' => 199_000,
            'max_tables' => 20,
            'max_items' => 40,
            'can_use_ai' => false,
            'is_active' => true,
        ]);
    }

    public function test_bang_goi_duoc_phep_dem_o_bien(): void
    {
        $this->taoGoi();

        $res = $this->getJson('/api/packages');

        $res->assertOk();
        $res->assertHeader('Cache-Control', 'max-age=0, public, s-maxage=60');
        $res->assertHeader('Access-Control-Allow-Origin', '*');

        // Đây mới là điều thật sự đang sửa: Cloudflare bỏ qua mọi phản hồi có `Vary`
        // khác `Accept-Encoding`, nên còn sót `Origin` là luật Cache Rules vô hiệu.
        $this->assertSame('Accept-Encoding', $res->headers->get('Vary'));
    }

    public function test_danh_sach_thoi_han_cua_goi_cung_duoc_dem(): void
    {
        $goi = $this->taoGoi();
        TimeSubscription::create([
            'package_id' => (string) $goi->id,
            'duration_months' => 12,
            'total_price' => 1_990_000,
            'is_active' => true,
        ]);

        $res = $this->getJson("/api/packages/{$goi->id}/time-subscriptions");

        $res->assertOk();
        $res->assertHeader('Access-Control-Allow-Origin', '*');
        $this->assertStringContainsString('s-maxage=60', $res->headers->get('Cache-Control'));
    }

    public function test_danh_gia_cong_khai_duoc_dem(): void
    {
        $res = $this->getJson('/api/reviews');

        $res->assertOk();
        $res->assertHeader('Access-Control-Allow-Origin', '*');
        $this->assertSame('Accept-Encoding', $res->headers->get('Vary'));
    }

    /**
     * Đệm chung được, đệm riêng thì KHÔNG.
     *
     * Đây là bài giữ chỗ cho một lỗi đã xảy ra thật: header từng là `max-age=300` nên
     * trình duyệt của chính chủ quán giữ bản cũ 5 phút, sửa đánh giá xong mở trang chủ
     * vẫn thấy nguyên văn cũ và tưởng phần mềm không lưu. `s-maxage` nói riêng với biên,
     * `max-age=0` bắt trình duyệt hỏi lại — đổi ngược lại là lỗi ấy quay về y nguyên.
     */
    public function test_trinh_duyet_khong_duoc_tu_giu_ban_cu(): void
    {
        $res = $this->getJson('/api/reviews');

        $cacheControl = (string) $res->headers->get('Cache-Control');

        $this->assertStringContainsString('max-age=0', $cacheControl,
            'Trình duyệt được phép tự giữ bản cũ — người vừa sửa đánh giá sẽ không thấy thay đổi.');
        $this->assertStringContainsString('s-maxage=60', $cacheControl,
            'Mất chỉ thị dành riêng cho biên thì Cloudflare thôi đệm, mỗi lượt xem lại bay sang Virginia.');
    }

    /**
     * ĐỐI CHỨNG. Đường có xác thực phải giữ nguyên CORS chặt và tuyệt đối không mang
     * `public` trong Cache-Control — dữ liệu quán mà lọt vào bộ đệm dùng chung thì
     * người lạ gọi cùng đường sẽ nhận lại chính nó.
     *
     * Phải tự dựng danh sách origin cụ thể: mặc định lúc kiểm thử là '*' (xem
     * config/cors.php), nên nếu không đặt lại thì bài này xanh kể cả khi middleware
     * mới lỡ nới cho toàn bộ /api — đúng thứ nó sinh ra để bắt.
     */
    public function test_duong_co_xac_thuc_van_giu_cors_chat(): void
    {
        config(['cors.allowed_origins' => ['https://funcafe.pro']]);

        $user = User::create([
            'name' => 'Chu quan',
            'email' => 'chu@funcafe.test',
            'password' => Hash::make('matkhau123'),
            'role' => 'user',
            'is_active' => true,
        ]);
        Shop::create([
            'user_id' => (string) $user->id,
            'name' => 'Quan Goc Nho',
            'address' => '1 Le Loi',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $res = $this->getJson('/api/shops', ['Origin' => 'https://funcafe.pro']);

        $res->assertOk();
        $this->assertNotSame('*', $res->headers->get('Access-Control-Allow-Origin'));
        $this->assertStringNotContainsString('public', (string) $res->headers->get('Cache-Control'));
    }
}
