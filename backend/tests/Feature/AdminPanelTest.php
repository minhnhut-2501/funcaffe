<?php

namespace Tests\Feature;

use App\Models\Cafe;
use App\Models\ContactMessage;
use App\Models\Package;
use App\Models\PackagePayment;
use App\Models\Review;
use App\Models\Subscription;
use App\Models\TimeSubscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;

/**
 * Khu quản trị — ranh giới quyền, và những thao tác KHÔNG được phép hủy dữ liệu cũ.
 *
 * Ba nhóm bất biến:
 *
 *  1. **Chủ quán không chạm được vào bất kỳ đường quản trị nào.** Kiểm bằng cách đi
 *     qua bảng route thật, không liệt kê tay.
 *  2. **Không xóa cứng thứ đã bán.** Mốc thời hạn, gói dịch vụ đều chỉ ẩn: giao dịch
 *     cũ còn trỏ tới chúng để tính ngày gia hạn và để đối soát.
 *  3. **Trang quản trị phải nhìn thấy cả những gì đã ẩn.** Dùng nhầm endpoint công
 *     khai (vốn lọc `status='active'`) thì ẩn xong là mất luôn đường bật lại.
 */
class AdminPanelTest extends MongoTestCase
{
    use RefreshDatabase;

    protected array $collections = [
        'users', 'cafes', 'packages', 'time_subscriptions', 'subscriptions',
        'package_payments', 'reviews', 'contact_messages',
    ];

    private User $admin;
    private User $chuQuan;
    private Cafe $quan;
    private Package $goi;
    private TimeSubscription $moc;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'full_name' => 'Quản trị viên', 'email' => 'ad-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'), 'role' => 'admin', 'status' => 'active',
        ]);
        $this->chuQuan = User::create([
            'full_name' => 'Chủ quán', 'email' => 'cq-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'), 'role' => 'user', 'status' => 'active',
        ]);
        $this->quan = $this->chuQuan->cafes()->create(['name' => 'Quán A', 'status' => 'open']);

        $this->goi = Package::create([
            'name' => 'Pro', 'type' => 'pro', 'level' => 1, 'status' => 'active',
            'is_trial' => false, 'can_use_ai' => false, 'max_tables' => 20, 'max_menu_items' => 40,
        ]);
        $this->moc = TimeSubscription::create([
            'package_id' => (string) $this->goi->id,
            'duration_value' => 6, 'duration_unit' => 'month',
            'price' => 600_000, 'label' => '6 tháng', 'status' => 'active',
        ]);
    }

    private function laAdmin(): void
    {
        Sanctum::actingAs($this->admin);
    }

    private function laChuQuan(): void
    {
        Sanctum::actingAs($this->chuQuan);
    }

    // ===== 7.1 Khung & quyền ===================================================

    /**
     * Việc 7.1.1 (`P0`) — chủ quán gõ thẳng đường quản trị nào cũng bị chặn ở MÁY CHỦ.
     *
     * Đi qua bảng route thật: thêm một đường `/admin/...` mới mà quên middleware thì
     * bài này đỏ ngay. Giao diện có chặn, nhưng giao diện không phải chốt chặn — ai
     * cũng gọi thẳng API được.
     *
     * Phải tạo bản ghi THẬT cho các tham số đường dẫn: ràng buộc model chạy TRƯỚC
     * middleware, nên id giả sẽ cho 404 và che mất câu trả lời thật là 403.
     */
    public function test_chu_quan_khong_vao_duoc_bat_ky_duong_quan_tri_nao(): void
    {
        $danhGia = Review::create([
            'user_id' => (string) $this->chuQuan->id, 'cafe_id' => (string) $this->quan->id,
            'rating' => 5, 'title' => 'Tốt', 'comment' => 'Rất tốt', 'status' => 'visible',
        ]);
        $tinNhan = ContactMessage::create([
            'full_name' => 'Khách', 'email' => 'khach@funcafe.test',
            'content' => 'Cho tôi hỏi về gói Pro', 'is_read' => false,
        ]);

        $thayThe = [
            '{user}' => (string) $this->chuQuan->id,
            '{review}' => (string) $danhGia->id,
            '{contact}' => (string) $tinNhan->id,
            '{package}' => (string) $this->goi->id,
            '{timeSubscription}' => (string) $this->moc->id,
        ];

        $this->laChuQuan();
        $lot = [];

        foreach (\Illuminate\Support\Facades\Route::getRoutes() as $route) {
            if (!str_starts_with($route->uri(), 'api/admin/')) {
                continue;
            }
            $duong = '/' . strtr($route->uri(), $thayThe);
            $cach = collect($route->methods())->first(fn ($m) => !in_array($m, ['HEAD', 'OPTIONS'], true));

            $ma = $this->json($cach, $duong, ['reply' => 'Xin chào bạn nhé'])->getStatusCode();
            if ($ma !== 403) {
                $lot[] = "{$cach} {$route->uri()} -> {$ma}";
            }
        }

        $this->assertNotEmpty($thayThe, 'Không có đường quản trị nào để kiểm — kiểm lại bộ lọc.');
        $this->assertSame([], $lot, "Chủ quán gọi được đường quản trị:\n" . implode("\n", $lot));
    }

    /** Việc 7.1.2 — tài khoản quản trị không có quán, nên không lẫn sang khu chủ quán. */
    public function test_tai_khoan_quan_tri_khong_co_quan_nao(): void
    {
        $this->laAdmin();

        $this->getJson('/api/cafes')->assertStatus(200)->assertJsonCount(0);
    }

    // ===== 7.2 Người dùng ======================================================

    /**
     * Việc 7.2.2 (`P0`) — khóa tài khoản thu hồi token NGAY.
     *
     * Dùng token thật và `forgetGuards()` giữa hai lượt gọi: guard sanctum nhớ người
     * dùng nó vừa dựng, không quên đi thì bài này xanh giả (xem AuthFlowTest).
     */
    public function test_khoa_tai_khoan_thu_hoi_token_ngay_lap_tuc(): void
    {
        $token = $this->chuQuan->createToken('auth-token')->plainTextToken;

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $token)->getJson('/api/user')->assertStatus(200);

        $this->laAdmin();
        $this->putJson("/api/admin/users/{$this->chuQuan->id}/lock")->assertStatus(200);

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $token)->getJson('/api/user')->assertStatus(401);
    }

    // ===== 7.3 Gói & thời hạn ==================================================

    /** Việc 7.3.1 — sửa giá một mốc thời hạn thì bảng giá công khai đổi theo ngay. */
    public function test_sua_gia_moc_thoi_han_doi_luon_o_bang_gia_cong_khai(): void
    {
        $this->laAdmin();
        $this->putJson("/api/admin/time-subscriptions/{$this->moc->id}", ['price' => 750_000])
            ->assertStatus(200);

        $congKhai = $this->getJson("/api/packages/{$this->goi->id}/time-subscriptions")->json();

        $this->assertSame(750_000, (int) $congKhai[0]['price']);
    }

    /**
     * Việc 7.3.2 — QUY TẮC CHỐT: sửa hạn mức gói có hiệu lực NGAY với người đang dùng.
     *
     * Hạn mức đọc thẳng từ tài liệu gói mỗi lần kiểm, không chép ảnh chụp vào
     * subscription. Nên nâng hạn mức là quán được dùng ngay (đúng ý khi admin nới tay),
     * và hạ hạn mức cũng có hiệu lực ngay. Bài này ghim quy tắc đó lại để không ai đổi
     * nó bằng một lần sửa vô tình.
     */
    public function test_sua_han_muc_goi_co_hieu_luc_ngay_voi_nguoi_dang_dung(): void
    {
        Subscription::create([
            'cafe_id' => (string) $this->quan->id,
            'package_id' => (string) $this->goi->id,
            'package_name_snapshot' => 'Pro',
            'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
            'total_amount' => 600_000, 'status' => 'active',
        ]);

        $this->laAdmin();
        $this->putJson("/api/admin/packages/{$this->goi->id}", ['max_tables' => 99])->assertStatus(200);

        $this->laChuQuan();
        $goiCuaQuan = $this->getJson("/api/cafes/{$this->quan->id}/subscriptions")->json();

        $this->assertSame(99, (int) $goiCuaQuan[0]['package']['max_tables'],
            'Hạn mức mới chưa tới được quán đang dùng gói đó.');
    }

    /**
     * Việc 7.3.3 · 7.3.5 (`P0`) — "xóa" một mốc thời hạn chỉ được phép là ẨN.
     *
     * Xóa cứng thì `SubscriptionActivator::computeRenewEndDate()` không tìm thấy bản
     * ghi và rơi về `addMonth()`: khách trả tiền 6 tháng chỉ được cộng 1 tháng, không
     * một lời cảnh báo nào.
     */
    public function test_xoa_moc_thoi_han_chi_la_an_chu_khong_mat_ban_ghi(): void
    {
        $this->laAdmin();
        $this->deleteJson("/api/admin/time-subscriptions/{$this->moc->id}")->assertStatus(200);

        $conDo = TimeSubscription::find($this->moc->id);
        $this->assertNotNull($conDo, 'Mốc thời hạn đã bị xóa khỏi CSDL.');
        $this->assertSame('inactive', $conDo->status);
        $this->assertSame(6, (int) $conDo->duration_value, 'Thời hạn đã mua phải còn tra cứu được.');
    }

    /**
     * Việc 7.3.4 (`P0`) — ẩn xong vẫn phải còn đường bật lại.
     *
     * Endpoint công khai lọc `status='active'`. Trang quản trị mà dùng nhầm nó thì ẩn
     * một mốc là mốc đó biến mất khỏi màn hình, không còn cách nào bật lại ngoài sửa
     * tay trong CSDL.
     */
    public function test_moc_da_an_bien_khoi_trang_cong_khai_nhung_admin_van_thay(): void
    {
        $this->laAdmin();
        $this->deleteJson("/api/admin/time-subscriptions/{$this->moc->id}")->assertStatus(200);

        $congKhai = $this->getJson("/api/packages/{$this->goi->id}/time-subscriptions")->json();
        $this->assertCount(0, $congKhai, 'Mốc đã ẩn vẫn hiện ở trang mua gói.');

        $cuaAdmin = $this->getJson('/api/admin/time-subscriptions')->json();
        $this->assertCount(1, $cuaAdmin, 'Admin không còn thấy mốc đã ẩn để bật lại.');
    }

    /** Cùng luật đó cho GÓI: tắt gói xong admin vẫn phải thấy để bật lại. */
    public function test_goi_da_tat_bien_khoi_trang_cong_khai_nhung_admin_van_thay(): void
    {
        $this->laAdmin();
        $this->putJson("/api/admin/packages/{$this->goi->id}", ['status' => 'inactive'])->assertStatus(200);

        $this->assertCount(0, $this->getJson('/api/packages')->json());
        $this->assertCount(1, $this->getJson('/api/admin/packages')->json());
    }

    // ===== 7.4 Đối soát thanh toán =============================================

    /**
     * Việc 7.4.1 (`P0`) — bảng đối soát CHỈ ĐỌC.
     *
     * Không có đường nào sửa được một bản ghi tài chính do cổng thanh toán trả về.
     * Để hở endpoint sửa là để hở luôn đường sửa bằng công cụ ngoài giao diện.
     */
    public function test_khong_co_duong_nao_sua_duoc_giao_dich(): void
    {
        $duongGhi = collect(\Illuminate\Support\Facades\Route::getRoutes())
            ->filter(fn ($r) => str_contains($r->uri(), 'admin/payments'))
            ->reject(fn ($r) => $r->methods() === ['GET', 'HEAD'])
            ->map(fn ($r) => implode('|', $r->methods()) . ' ' . $r->uri())
            ->values()->all();

        $this->assertSame([], $duongGhi, "Có đường ghi trên bảng đối soát:\n" . implode("\n", $duongGhi));
    }

    /** Việc 7.4.2 — bảng đối soát hiện đủ những gì cần để đối chiếu với sao kê. */
    public function test_bang_doi_soat_hien_du_cac_truong_can_thiet(): void
    {
        $this->taoGiaoDich('paid');

        $this->laAdmin();
        $dong = $this->getJson('/api/admin/payments')->assertStatus(200)->json()[0];

        // `time_subscription` (snake_case) chứ không `timeSubscription`: Laravel
        // serialize quan hệ theo tên snake, và `services/payments.ts` đọc đúng tên đó
        // để hiện cột "Thời hạn". Đọc sai tên thì mọi giao dịch đều hiện "1 tháng".
        foreach (['user', 'package', 'amount', 'subtotal', 'vat_amount', 'payment_method',
                  'transaction_code', 'payment_status', 'created_at', 'time_subscription'] as $truong) {
            $this->assertArrayHasKey($truong, $dong, "Thiếu trường '{$truong}' để đối soát.");
        }

        $this->assertSame(6, (int) $dong['time_subscription']['duration_value']);
        $this->assertSame('month', $dong['time_subscription']['duration_unit']);
    }

    /** Đơn cổng còn 'pending' (khách bấm mua rồi bỏ dở) không phải doanh thu — phải ẩn. */
    public function test_don_cong_dang_cho_khong_lot_vao_bang_doi_soat(): void
    {
        $this->taoGiaoDich('pending', 'vnpay');
        $this->taoGiaoDich('paid', 'vnpay');

        $this->laAdmin();
        $rows = $this->getJson('/api/admin/payments')->json();

        $this->assertCount(1, $rows);
        $this->assertSame('paid', $rows[0]['payment_status']);
    }

    // ===== 7.5 Doanh thu hệ thống ==============================================

    /**
     * Việc 7.5.2 (`P0`) — doanh thu ròng đã trừ phần cấn trừ.
     *
     * Hệ thống không có khâu hoàn tiền; khoản trừ duy nhất là phần cấn trừ khi nâng
     * cấp giữa kỳ. Điều cần giữ: `amount` của giao dịch nâng cấp là **số THỰC TRẢ**
     * (đã trừ cấn trừ), không phải giá niêm yết. Trang Doanh thu hệ thống cộng thẳng
     * `amount`, nên ghi giá niêm yết vào đó là thổi phồng doanh thu đúng bằng tổng
     * số tiền đã cấn trừ cho khách — một khoản chưa bao giờ vào tài khoản.
     */
    public function test_giao_dich_nang_cap_ghi_so_thuc_tra_chu_khong_phai_gia_niem_yet(): void
    {
        $gd = $this->taoGiaoDich('paid');
        $gd->update(['action_type' => 'upgrade', 'credit_amount' => 200_000, 'amount' => 400_000]);

        $this->laAdmin();
        $dong = collect($this->getJson('/api/admin/payments')->json())
            ->firstWhere('transaction_code', $gd->transaction_code);

        $this->assertSame(400_000, (int) $dong['amount']);
        $this->assertSame(200_000, (int) $dong['credit_amount'],
            'Khoản cấn trừ phải còn nhìn thấy được như một dòng biên lai.');
    }

    // ===== 7.6 Đánh giá ========================================================

    /** Việc 7.6.1 — ẩn/hiện một đánh giá phản ánh NGAY ra trang công khai. */
    public function test_an_hien_danh_gia_phan_anh_ngay_ra_trang_cong_khai(): void
    {
        Subscription::create([
            'cafe_id' => (string) $this->quan->id, 'package_id' => (string) $this->goi->id,
            'package_name_snapshot' => 'Pro',
            'start_date' => now()->subDay(), 'end_date' => now()->addMonth(),
            'total_amount' => 600_000, 'status' => 'active',
        ]);
        $dg = Review::create([
            'user_id' => (string) $this->chuQuan->id, 'cafe_id' => (string) $this->quan->id,
            'rating' => 5, 'title' => 'Tốt', 'comment' => 'Rất tốt', 'status' => 'visible',
        ]);

        $this->laAdmin();
        $this->assertCount(1, $this->getJson('/api/reviews')->json());

        $this->putJson("/api/admin/reviews/{$dg->id}/toggle")->assertStatus(200);
        $this->assertCount(0, $this->getJson('/api/reviews')->json(), 'Ẩn rồi vẫn còn trên trang chủ.');

        $this->putJson("/api/admin/reviews/{$dg->id}/toggle")->assertStatus(200);
        $this->assertCount(1, $this->getJson('/api/reviews')->json(), 'Hiện lại không quay về trang chủ.');
    }

    /** Danh sách đánh giá cho admin không được nhúng nguyên đối tượng người dùng. */
    public function test_danh_sach_danh_gia_cua_admin_khong_kem_mat_khau(): void
    {
        Review::create([
            'user_id' => (string) $this->chuQuan->id, 'cafe_id' => (string) $this->quan->id,
            'rating' => 4, 'title' => 'Khá', 'comment' => 'Dùng được', 'status' => 'visible',
        ]);

        $this->laAdmin();
        $than = json_encode($this->getJson('/api/admin/reviews')->json(), JSON_UNESCAPED_UNICODE);

        $this->assertStringNotContainsString('$2y$', $than, 'Lọt ra chuỗi băm mật khẩu.');
        $this->assertStringContainsString('Chủ quán', $than, 'Vẫn phải có tên người viết để hiển thị.');
    }

    // ===== 7.7 Tin nhắn liên hệ ================================================

    /**
     * Việc 7.7.1 — đánh dấu đã đọc nhận giá trị MONG MUỐN, bấm hai lần ra cùng kết quả.
     *
     * Đảo trạng thái hiện tại thì hai quản trị viên bấm cùng lúc (hoặc một người bấm
     * hai lần vì mạng chậm) sẽ ra kết quả phụ thuộc thứ tự đến — có khi quay về đúng
     * chỗ cũ.
     */
    public function test_danh_dau_da_doc_bam_hai_lan_ra_cung_ket_qua(): void
    {
        $tin = ContactMessage::create([
            'full_name' => 'Khách', 'email' => 'khach@funcafe.test',
            'content' => 'Tư vấn giúp tôi gói Pro', 'is_read' => false,
        ]);

        $this->laAdmin();
        $this->putJson("/api/admin/contacts/{$tin->id}/read", ['is_read' => true])->assertStatus(200);
        $this->putJson("/api/admin/contacts/{$tin->id}/read", ['is_read' => true])->assertStatus(200);

        $this->assertTrue((bool) ContactMessage::find($tin->id)->is_read);
    }

    /**
     * Việc 7.7.3 (`P0`) — gửi thư hỏng thì KHÔNG được ghi nhận "đã trả lời".
     *
     * Ghi CSDL trước rồi gửi sau là kịch bản tệ nhất: hệ thống nói đã trả lời, khách
     * không nhận được gì, và admin không có cách nào biết để gửi lại.
     */
    public function test_gui_thu_that_bai_thi_tin_nhan_van_o_trang_thai_chua_tra_loi(): void
    {
        $tin = ContactMessage::create([
            'full_name' => 'Khách', 'email' => 'khach@funcafe.test',
            'content' => 'Tư vấn giúp tôi gói Pro', 'is_read' => false,
        ]);

        Mail::shouldReceive('to->send')->andThrow(new \RuntimeException('SMTP từ chối kết nối'));

        $this->laAdmin();
        $res = $this->postJson("/api/admin/contacts/{$tin->id}/reply", [
            'reply' => 'Chào bạn, gói Pro hiện có giá 600.000đ cho 6 tháng.',
        ]);

        $res->assertStatus(502);
        $this->assertStringContainsString('chưa trả lời', $res->json('message'),
            'Admin phải đọc được rằng thư CHƯA gửi đi.');

        $sau = ContactMessage::find($tin->id);
        $this->assertNull($sau->reply, 'Đã ghi "đã trả lời" trong khi thư không gửi được.');
        $this->assertNull($sau->replied_at);
    }

    /** Gửi được thì mới ghi — và ghi đủ nội dung lẫn người trả lời. */
    public function test_gui_thu_thanh_cong_thi_ghi_lai_noi_dung_da_tra_loi(): void
    {
        Mail::fake();

        $tin = ContactMessage::create([
            'full_name' => 'Khách', 'email' => 'khach@funcafe.test',
            'content' => 'Tư vấn giúp tôi gói Pro', 'is_read' => false,
        ]);

        $this->laAdmin();
        $this->postJson("/api/admin/contacts/{$tin->id}/reply", [
            'reply' => 'Chào bạn, gói Pro hiện có giá 600.000đ cho 6 tháng.',
        ])->assertStatus(200);

        $sau = ContactMessage::find($tin->id);
        $this->assertStringContainsString('600.000đ', $sau->reply);
        $this->assertNotNull($sau->replied_at);
        $this->assertTrue((bool) $sau->is_read, 'Đã trả lời thì đương nhiên là đã đọc.');
        Mail::assertSent(\App\Mail\ContactReplyMail::class);
    }

    /**
     * Việc 7.7.4 — phân trang THẬT.
     *
     * Trước đây là `limit(200)` không kèm đường đi tiếp: tin thứ 201 nằm trong CSDL mà
     * không có cách nào đọc tới. Endpoint gửi liên hệ là công khai, nên chỉ vài trăm
     * tin rác là liên hệ thật của khách bị đẩy ra ngoài tầm nhìn.
     */
    public function test_tin_nhan_lien_he_phan_trang_that(): void
    {
        foreach (range(1, 7) as $i) {
            ContactMessage::create([
                'full_name' => "Khách {$i}", 'email' => "k{$i}@funcafe.test",
                'content' => "Nội dung {$i}", 'is_read' => false,
            ]);
        }

        $this->laAdmin();

        $trang1 = $this->getJson('/api/admin/contacts?per_page=3')->assertStatus(200)->json();
        $this->assertCount(3, $trang1['data']);
        $this->assertSame(7, $trang1['total']);
        $this->assertSame(3, $trang1['last_page']);

        $trang3 = $this->getJson('/api/admin/contacts?per_page=3&page=3')->json();
        $this->assertCount(1, $trang3['data'], 'Trang cuối phải đọc tới được.');
    }

    /**
     * Chuông báo hỏi "tin chưa đọc" và MÁY CHỦ phải lọc.
     *
     * Lấy vài tin mới nhất rồi tự lọc ở trình duyệt thì mười tin mới nhất đều đã đọc
     * là chuông im, trong khi tin chưa đọc vẫn nằm bên dưới — im lặng đúng lúc có
     * người đang chờ trả lời.
     */
    public function test_loc_duoc_rieng_tin_chua_doc(): void
    {
        foreach (range(1, 5) as $i) {
            ContactMessage::create([
                'full_name' => "Khách {$i}", 'email' => "k{$i}@funcafe.test",
                'content' => "Nội dung {$i}",
                // Bốn tin MỚI NHẤT đã đọc; tin chưa đọc là tin cũ nhất, nằm dưới cùng.
                'is_read' => $i > 1,
            ]);
        }

        $this->laAdmin();

        $chuaDoc = $this->getJson('/api/admin/contacts?is_read=0&per_page=10')->json();
        $this->assertCount(1, $chuaDoc['data']);
        $this->assertSame('Khách 1', $chuaDoc['data'][0]['full_name']);

        $daDoc = $this->getJson('/api/admin/contacts?is_read=1&per_page=10')->json();
        $this->assertCount(4, $daDoc['data']);

        $tatCa = $this->getJson('/api/admin/contacts?per_page=10')->json();
        $this->assertCount(5, $tatCa['data'], 'Không truyền is_read thì phải trả về tất cả.');
    }

    // ===== Tiện ích ============================================================

    private function taoGiaoDich(string $trangThai, string $cach = 'vnpay'): PackagePayment
    {
        $sub = Subscription::create([
            'cafe_id' => (string) $this->quan->id,
            'package_id' => (string) $this->goi->id,
            'time_subscription_id' => (string) $this->moc->id,
            'package_name_snapshot' => 'Pro',
            'start_date' => now()->subDay(), 'end_date' => now()->addMonths(6),
            'total_amount' => 600_000, 'status' => $trangThai === 'paid' ? 'active' : 'pending',
        ]);

        return $sub->packagePayments()->create([
            'user_id' => (string) $this->chuQuan->id,
            'cafe_id' => (string) $this->quan->id,
            'package_id' => (string) $this->goi->id,
            'time_subscription_id' => (string) $this->moc->id,
            'subtotal' => 545_455, 'vat_rate' => 10, 'vat_amount' => 54_545,
            'amount' => 600_000,
            'payment_method' => $cach,
            'payment_status' => $trangThai,
            'transaction_code' => 'TXN' . uniqid(),
            'paid_at' => $trangThai === 'paid' ? now() : null,
            'action_type' => 'new',
            'credit_amount' => 0,
        ]);
    }
}
