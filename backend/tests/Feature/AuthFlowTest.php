<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

/**
 * Cửa vào hệ thống: đăng ký, đăng nhập, đăng xuất, quên mật khẩu, hồ sơ cá nhân.
 *
 * Đây là phần mã duy nhất mà một người CHƯA có tài khoản chạm tới được, nên mọi lỗ
 * hổng ở đây đều mở ra cho cả internet. Ba nhóm bất biến được giữ:
 *
 *  1. **Không ai tự nâng quyền cho mình.** Vai trò và trạng thái tài khoản do máy chủ
 *     đặt, không lấy từ thân yêu cầu.
 *  2. **Không tiết lộ email nào có trong hệ thống.** Sai email và sai mật khẩu phải
 *     cho ra cùng một câu; quên mật khẩu phải trả lời như nhau cho email có và không có.
 *  3. **Token phải chết đúng lúc.** Đăng xuất, bị khóa, đặt lại mật khẩu — cả ba đều
 *     làm token đang cầm mất hiệu lực NGAY, không đợi tới lần đăng nhập sau.
 *
 * Token của Sanctum nằm ở SQLite (xem `PersonalAccessToken`), nên bài nào đụng tới
 * token phải có `RefreshDatabase` để dựng bảng.
 *
 * `Sanctum::actingAs()` KHÔNG dùng được ở đây: nó gắn một token giả (`TransientToken`)
 * không có bản ghi thật, nên không kiểm được chuyện thu hồi. Mọi bài dưới đây đăng
 * nhập bằng token thật, đúng như trình duyệt.
 */
class AuthFlowTest extends MongoTestCase
{
    use RefreshDatabase;

    protected array $collections = ['users', 'shops', 'subscriptions', 'packages'];

    private const MAT_KHAU = 'Password@123';

    protected function setUp(): void
    {
        parent::setUp();
    }

    private function taoNguoiDung(array $doiLai = []): User
    {
        return User::create(array_merge([
            'full_name' => 'Chủ quán',
            'email' => 'auth-' . uniqid() . '@funcafe.test',
            'password' => Hash::make(self::MAT_KHAU),
            'phone' => '0901234567',
            'role' => 'user',
            'status' => 'active',
        ], $doiLai));
    }

    /** Token thật kèm sẵn header — giống hệt cái trình duyệt gửi đi. */
    private function tokenCua(User $user): string
    {
        return $user->createToken('auth-token')->plainTextToken;
    }

    /**
     * Gửi một lượt gọi kèm token — và QUÊN người dùng đã xác thực ở lượt trước.
     *
     * Trong một bài kiểm thử, cả ứng dụng chỉ dựng một lần: `AuthManager` sống xuyên
     * suốt và guard 'sanctum' nhớ luôn người dùng nó vừa dựng ra. Vì vậy lượt gọi thứ
     * hai KHÔNG đọc lại token — nó dùng lại người dùng đã nhớ. Không quên đi thì mọi
     * bài "token này phải chết rồi" đều xanh giả: token đã xóa vẫn vào được vì có ai
     * đọc tới nó đâu.
     *
     * Chạy thật thì mỗi lượt gọi là một tiến trình PHP mới, không có bộ nhớ nào cả —
     * `forgetGuards()` là cách dựng lại đúng hoàn cảnh đó.
     */
    private function voiToken(string $token): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }

    private function dangKy(array $doiLai = [])
    {
        return $this->postJson('/api/auth/register', array_merge([
            'full_name' => 'Người mới',
            'email' => 'moi-' . uniqid() . '@funcafe.test',
            'password' => self::MAT_KHAU,
            'phone' => '0901234567',
        ], $doiLai));
    }

    // ===== 2.1 Đăng ký =========================================================

    /**
     * Việc 2.1.1 — giao diện và máy chủ phải cùng một luật.
     *
     * Bài này là bản dịch sang mã của `src/lib/validate.ts`: mỗi giá trị mà ô nhập ở
     * giao diện tô đỏ thì máy chủ cũng phải từ chối, và ngược lại. Lệch nhau kiểu nào
     * cũng tệ: giao diện lỏng hơn thì người dùng bấm Lưu rồi ăn một câu lỗi không rõ
     * ô nào; máy chủ lỏng hơn thì gọi thẳng API là ghi được rác vào CSDL.
     */
    public function test_so_dien_thoai_giao_dien_chan_thi_may_chu_cung_chan(): void
    {
        foreach (['abc', '123', '090123456789012', '+1 650 253 0000'] as $so) {
            $this->dangKy(['phone' => $so])
                ->assertStatus(422)
                ->assertJsonValidationErrors('phone');
        }
    }

    public function test_so_dien_thoai_that_van_qua_du_dau_cach(): void
    {
        // Ô nhập ở giao diện gợi ý "0901 234 567" — chính nó phải qua được.
        foreach (['0901234567', '0901 234 567', '090.123.4567', '+84901234567', '0287654321'] as $so) {
            $this->dangKy(['phone' => $so])->assertStatus(201);
        }
    }

    public function test_khong_co_so_dien_thoai_van_dang_ky_duoc(): void
    {
        $this->dangKy(['phone' => ''])->assertStatus(201);
    }

    public function test_mat_khau_ngan_hon_tam_ky_tu_bi_chan(): void
    {
        $this->dangKy(['password' => 'Pass@12'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }

    public function test_email_sai_dinh_dang_bi_chan(): void
    {
        $this->dangKy(['email' => 'khong-phai-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    /** Việc 2.1.2 — báo trùng rõ ràng, nhưng không kèm gì về tài khoản đã có. */
    public function test_email_trung_bao_ro_ma_khong_lo_them_thong_tin(): void
    {
        $cu = $this->taoNguoiDung(['full_name' => 'Nguyễn Văn Cũ', 'phone' => '0912345678']);

        $res = $this->dangKy(['email' => $cu->email])->assertStatus(422);

        $than = json_encode($res->json(), JSON_UNESCAPED_UNICODE);
        $this->assertStringContainsString('đã được đăng ký', $than);
        $this->assertStringNotContainsString('Nguyễn Văn Cũ', $than, 'Lộ tên chủ tài khoản đã có.');
        $this->assertStringNotContainsString('0912345678', $than, 'Lộ số điện thoại chủ tài khoản đã có.');
    }

    /**
     * Việc 2.1.3 — vai trò do máy chủ đặt, không lấy từ thân yêu cầu.
     *
     * Một dòng `User::create($request->all())` là đủ để bất kỳ ai đăng ký thành quản
     * trị viên. Bài này gửi kèm đủ thứ nhạy cảm để chắc không cái nào lọt.
     */
    public function test_khong_tu_dat_duoc_vai_tro_va_trang_thai_khi_dang_ky(): void
    {
        $email = 'kegian-' . uniqid() . '@funcafe.test';

        $this->dangKy([
            'email' => $email,
            'role' => 'admin',
            'status' => 'locked',
            'has_used_free_trial' => false,
        ])->assertStatus(201);

        $u = User::where('email', $email)->first();
        $this->assertSame('user', $u->role, 'Đăng ký tự nâng được lên quản trị.');
        $this->assertSame('active', $u->status);
    }

    /** Việc 2.1.4 — đăng ký xong là dùng được ngay, không cần đăng nhập lại. */
    public function test_dang_ky_tra_ve_token_dung_duoc_ngay(): void
    {
        $res = $this->dangKy()->assertStatus(201);

        $this->voiToken($res->json('token'))
            ->getJson('/api/user')
            ->assertStatus(200)
            ->assertJsonPath('role', 'user');
    }

    /** Mật khẩu không bao giờ được trả ra, kể cả dạng băm. */
    public function test_phan_hoi_dang_ky_khong_kem_mat_khau(): void
    {
        $than = json_encode($this->dangKy()->json(), JSON_UNESCAPED_UNICODE);

        $this->assertStringNotContainsString('password', $than);
        $this->assertStringNotContainsString('$2y$', $than, 'Lọt ra chuỗi băm bcrypt.');
    }

    // ===== 2.2 Đăng nhập & đăng xuất ===========================================

    /**
     * Việc 2.2.1 — sai email và sai mật khẩu cho ra CÙNG một câu.
     *
     * Hai câu khác nhau biến form đăng nhập thành công cụ dò email: gõ thử một danh
     * sách địa chỉ, cái nào trả "sai mật khẩu" là cái đó có tài khoản ở đây.
     */
    public function test_sai_email_va_sai_mat_khau_cho_cung_mot_cau(): void
    {
        $u = $this->taoNguoiDung();

        $saiMatKhau = $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'SaiRoi@123']);
        $khongTonTai = $this->postJson('/api/auth/login', ['email' => 'khongcoai@funcafe.test', 'password' => 'SaiRoi@123']);

        $saiMatKhau->assertStatus(422);
        $khongTonTai->assertStatus(422);
        $this->assertSame(
            $khongTonTai->json('errors.email'),
            $saiMatKhau->json('errors.email'),
            'Hai câu khác nhau là chỉ ra email nào có thật trong hệ thống.',
        );
    }

    /**
     * Câu "tài khoản bị khóa" chỉ hiện khi mật khẩu ĐÚNG.
     *
     * Đó là lý do phép kiểm khóa nằm SAU phép kiểm mật khẩu trong AuthController.
     * Đảo thứ tự thì ai cũng dò được email nào tồn tại mà không cần biết mật khẩu.
     */
    public function test_cau_bao_khoa_chi_hien_khi_mat_khau_dung(): void
    {
        $u = $this->taoNguoiDung(['status' => 'locked']);

        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => self::MAT_KHAU])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');

        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'SaiRoi@123'])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Thông tin đăng nhập không chính xác.');
    }

    /**
     * Việc 2.2.2 (`P0`) — khóa tài khoản có hiệu lực NGAY với token đang cầm.
     *
     * Đặt trạng thái thẳng vào CSDL, KHÔNG qua `Admin\UserController::toggleLock()`.
     * Chỗ đó có thu hồi token, nhưng đó là việc nó nhớ làm. Bài này hỏi câu khác:
     * luật "khóa là không vào được" có còn đúng khi trạng thái được đặt bằng đường
     * khác không — sửa tay lúc xử lý sự cố, một tác vụ nền sau này, hay một chỗ gọi
     * mới quên thu hồi. Chốt chặn thật nằm ở middleware EnsureAccountActive.
     */
    public function test_khoa_giua_phien_thi_token_dang_cam_het_hieu_luc(): void
    {
        $u = $this->taoNguoiDung();
        $token = $this->tokenCua($u);

        $this->voiToken($token)->getJson('/api/user')->assertStatus(200);

        User::where('_id', $u->id)->update(['status' => 'locked']);

        $this->voiToken($token)->getJson('/api/user')->assertStatus(401);
    }

    /** Việc 2.2.3 (`P0`) — đăng xuất thu hồi ở MÁY CHỦ, không chỉ xóa ở trình duyệt. */
    public function test_dang_xuat_lam_token_cu_het_dung_duoc(): void
    {
        $token = $this->tokenCua($this->taoNguoiDung());

        $this->voiToken($token)->postJson('/api/auth/logout')->assertStatus(200);

        // Cùng token đó, giống hệt trường hợp bị chép lại trước khi đăng xuất.
        $this->voiToken($token)->getJson('/api/user')->assertStatus(401);
    }

    /** Đăng xuất ở máy này không được đá người dùng ra khỏi máy kia. */
    public function test_dang_xuat_khong_dung_toi_thiet_bi_khac(): void
    {
        $u = $this->taoNguoiDung();
        $mayQuay = $this->tokenCua($u);
        $dienThoai = $this->tokenCua($u);

        $this->voiToken($mayQuay)->postJson('/api/auth/logout')->assertStatus(200);

        $this->voiToken($dienThoai)->getJson('/api/user')->assertStatus(200);
    }

    // ===== 2.3 Quên & đặt lại mật khẩu =========================================

    /** Việc 2.3.1 — email có và không có phải trả lời giống hệt nhau. */
    public function test_quen_mat_khau_tra_loi_giong_nhau_du_email_co_hay_khong(): void
    {
        $u = $this->taoNguoiDung();

        $co = $this->postJson('/api/auth/forgot-password', ['email' => $u->email]);
        $khong = $this->postJson('/api/auth/forgot-password', ['email' => 'khongcoai@funcafe.test']);

        $this->assertSame($khong->getStatusCode(), $co->getStatusCode());
        $this->assertSame($khong->json(), $co->json(), 'Hai phản hồi khác nhau là chỉ ra email nào có thật.');
    }

    /**
     * Việc 2.3.2 (`P0`) — mã đặt lại lưu dạng BĂM.
     *
     * Ai đọc được CSDL (bản sao lưu, kết xuất chẩn đoán, tài khoản chỉ-đọc) mà thấy
     * mã thô là dựng lại được liên kết đặt mật khẩu của bất kỳ ai, không cần mật khẩu cũ.
     */
    public function test_ma_dat_lai_luu_trong_csdl_o_dang_bam(): void
    {
        $u = $this->taoNguoiDung();
        $ma = $this->layMaDatLai($u);

        $luu = User::where('_id', $u->id)->first()->reset_token;

        $this->assertNotSame($ma, $luu, 'Mã đặt lại đang nằm nguyên văn trong CSDL.');
        $this->assertSame(hash('sha256', $ma), $luu);
    }

    /** Việc 2.3.2 — dùng một lần. */
    public function test_ma_dat_lai_chi_dung_duoc_mot_lan(): void
    {
        $u = $this->taoNguoiDung();
        $ma = $this->layMaDatLai($u);

        $this->datLai($u->email, $ma, 'MoiToanh@123')->assertStatus(200);
        $this->datLai($u->email, $ma, 'LanHai@1234')->assertStatus(400);

        $this->assertTrue(
            Hash::check('MoiToanh@123', User::where('_id', $u->id)->first()->password),
            'Lần đặt lại thứ hai đã ghi đè mật khẩu.',
        );
    }

    /** Việc 2.3.2 — có hạn dùng. */
    public function test_ma_dat_lai_qua_han_bi_tu_choi(): void
    {
        $u = $this->taoNguoiDung();
        $ma = $this->layMaDatLai($u);

        User::where('_id', $u->id)->update(['reset_token_expires_at' => now()->subMinute()]);

        $this->datLai($u->email, $ma, 'MoiToanh@123')->assertStatus(400);
    }

    /** Mã của người này không mở được tài khoản người kia. */
    public function test_ma_dat_lai_cua_nguoi_khac_khong_dung_duoc(): void
    {
        $a = $this->taoNguoiDung();
        $b = $this->taoNguoiDung();
        $maCuaA = $this->layMaDatLai($a);

        $this->datLai($b->email, $maCuaA, 'MoiToanh@123')->assertStatus(400);
    }

    /**
     * Việc 2.3.3 (`P0`) — đặt lại mật khẩu đẩy MỌI phiên cũ ra ngoài.
     *
     * Người ta đặt lại mật khẩu chủ yếu vì nghi tài khoản đã lộ. Giữ lại phiên cũ
     * nghĩa là kẻ đang chiếm tài khoản vẫn ngồi nguyên trong đó sau khi chủ nhà
     * "đã xử lý xong".
     */
    public function test_dat_lai_mat_khau_thu_hoi_moi_token_cu(): void
    {
        $u = $this->taoNguoiDung();
        $tokenCu = $this->tokenCua($u);
        $ma = $this->layMaDatLai($u);

        $this->datLai($u->email, $ma, 'MoiToanh@123')->assertStatus(200);

        $this->voiToken($tokenCu)->getJson('/api/user')->assertStatus(401);
    }

    // ===== 2.4 Hồ sơ cá nhân ===================================================

    /** Việc 2.4.1 (`P0`) — không biết mật khẩu cũ thì không đổi được. */
    public function test_doi_mat_khau_bat_buoc_dung_mat_khau_hien_tai(): void
    {
        $u = $this->taoNguoiDung();

        $this->voiToken($this->tokenCua($u))->putJson('/api/user/password', [
            'current_password' => 'DoanBua@123',
            'new_password' => 'MoiToanh@123',
            'confirm_password' => 'MoiToanh@123',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check(self::MAT_KHAU, User::where('_id', $u->id)->first()->password));
    }

    /**
     * Việc 2.4.1 (`P0`) — đổi xong: giữ máy đang ngồi, đá các máy còn lại.
     *
     * Thu hồi tất cả (kể cả token hiện tại) thì vừa bấm Đổi xong là bị văng ra, trông
     * y như đổi hỏng. Không thu hồi cái nào thì đổi mật khẩu chẳng đuổi được ai.
     */
    public function test_doi_mat_khau_giu_may_dang_dung_va_thu_hoi_may_khac(): void
    {
        $u = $this->taoNguoiDung();
        $dangDung = $this->tokenCua($u);
        $mayKhac = $this->tokenCua($u);

        $this->voiToken($dangDung)->putJson('/api/user/password', [
            'current_password' => self::MAT_KHAU,
            'new_password' => 'MoiToanh@123',
            'confirm_password' => 'MoiToanh@123',
        ])->assertStatus(200);

        $this->voiToken($dangDung)->getJson('/api/user')->assertStatus(200);
        $this->voiToken($mayKhac)->getJson('/api/user')->assertStatus(401);
    }

    /**
     * Việc 2.4.2 — email KHÔNG đổi được qua hồ sơ, và không được âm thầm ghi.
     *
     * Email là tên đăng nhập và là địa chỉ nhận liên kết đặt lại mật khẩu. Cho đổi mà
     * chưa có bước xác minh địa chỉ mới thì gõ sai một ký tự là mất luôn đường vào.
     */
    public function test_khong_doi_duoc_email_qua_ho_so(): void
    {
        $u = $this->taoNguoiDung();

        $this->voiToken($this->tokenCua($u))->putJson('/api/user', [
            'full_name' => 'Tên mới',
            'email' => 'doi-trom@funcafe.test',
        ])->assertStatus(200);

        $sau = User::where('_id', $u->id)->first();
        $this->assertSame($u->email, $sau->email, 'Email đã bị đổi qua đường sửa hồ sơ.');
        $this->assertSame('Tên mới', $sau->full_name, 'Phần được phép sửa thì vẫn phải sửa được.');
    }

    public function test_khong_tu_nang_quyen_qua_ho_so(): void
    {
        $u = $this->taoNguoiDung();

        $this->voiToken($this->tokenCua($u))->putJson('/api/user', [
            'role' => 'admin',
            'status' => 'active',
            'has_used_free_trial' => false,
        ])->assertStatus(200);

        $this->assertSame('user', User::where('_id', $u->id)->first()->role);
    }

    /** Việc 2.1.1 lặp lại ở hồ sơ: cùng luật số điện thoại với lúc đăng ký. */
    public function test_ho_so_dung_cung_luat_so_dien_thoai_voi_dang_ky(): void
    {
        $u = $this->taoNguoiDung();
        $token = $this->tokenCua($u);

        $this->voiToken($token)->putJson('/api/user', ['phone' => 'abc'])
            ->assertStatus(422)->assertJsonValidationErrors('phone');

        $this->voiToken($token)->putJson('/api/user', ['phone' => '0987 654 321'])
            ->assertStatus(200);
    }

    // ===== 2.5 Giới hạn tần suất & an toàn phiên ===============================

    /**
     * Việc 2.5.1 — dò mật khẩu bị chặn sau 10 lần/phút, và câu trả lời phải tử tế.
     *
     * `api-client` dịch 429 thành "Bạn thao tác quá nhanh. Vui lòng đợi một phút rồi
     * thử lại." nên người dùng không thấy màn hình lỗi thô.
     */
    public function test_dang_nhap_sai_lien_tuc_bi_chan(): void
    {
        $u = $this->taoNguoiDung();

        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'Sai@12345'])
                ->assertStatus(422);
        }

        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => self::MAT_KHAU])
            ->assertStatus(429);
    }

    /** Dò `current_password` cũng phải bị chặn — đó cũng là dò mật khẩu. */
    public function test_doi_mat_khau_doan_lien_tuc_bi_chan(): void
    {
        $token = $this->tokenCua($this->taoNguoiDung());

        for ($i = 0; $i < 10; $i++) {
            $this->voiToken($token)->putJson('/api/user/password', [
                'current_password' => 'DoanBua@' . $i,
                'new_password' => 'MoiToanh@123',
                'confirm_password' => 'MoiToanh@123',
            ])->assertStatus(422);
        }

        $this->voiToken($token)->putJson('/api/user/password', [
            'current_password' => self::MAT_KHAU,
            'new_password' => 'MoiToanh@123',
            'confirm_password' => 'MoiToanh@123',
        ])->assertStatus(429);
    }

    /**
     * Việc 2.5.2 — MỌI đường ghi đều phải có trần tần suất.
     *
     * Đi qua bảng route thật thay vì liệt kê tay: thêm một endpoint ghi mới mà quên
     * trần thì bài này đỏ ngay. Trần chung 300 lượt/phút nằm ở nhóm `api`
     * (bootstrap/app.php), vài đường nhạy cảm còn có trần riêng chặt hơn.
     */
    public function test_moi_duong_ghi_deu_co_tran_tan_suat(): void
    {
        $thieu = [];

        foreach (\Illuminate\Support\Facades\Route::getRoutes() as $route) {
            if (!str_starts_with($route->uri(), 'api/')) {
                continue;
            }
            $ghi = array_intersect($route->methods(), ['POST', 'PUT', 'PATCH', 'DELETE']);
            if (!$ghi) {
                continue;
            }

            // `gatherRouteMiddleware()` bung cả NHÓM middleware ra thành tên lớp.
            // Dùng `$route->gatherMiddleware()` thì chỉ thấy chuỗi 'api' — trần chung
            // nằm trong nhóm đó nên sẽ tưởng là mọi đường đều thiếu trần.
            $coThrottle = collect(app('router')->gatherRouteMiddleware($route))
                ->contains(fn ($mw) => is_string($mw) && str_contains($mw, 'ThrottleRequests'));

            if (!$coThrottle) {
                $thieu[] = implode('|', $ghi) . ' ' . $route->uri();
            }
        }

        $this->assertSame([], $thieu, "Đường ghi không có trần tần suất:\n" . implode("\n", $thieu));
    }

    /**
     * Việc 2.5.3 — token có hạn 30 ngày, không sống mãi.
     *
     * Chính sách chốt ở `config/sanctum.php`. Bài này kiểm hiệu lực thật chứ không chỉ
     * đọc lại con số: lùi ngày tạo token quá hạn rồi thử dùng.
     */
    public function test_token_qua_ba_muoi_ngay_thi_het_hieu_luc(): void
    {
        $this->assertSame(60 * 24 * 30, config('sanctum.expiration'), 'Chính sách hạn token đã bị đổi.');

        $u = $this->taoNguoiDung();
        $token = $this->tokenCua($u);

        $this->voiToken($token)->getJson('/api/user')->assertStatus(200);

        \App\Models\PersonalAccessToken::query()
            ->update(['created_at' => now()->subDays(31)]);

        $this->voiToken($token)->getJson('/api/user')->assertStatus(401);
    }

    // ===== Tiện ích ============================================================

    /**
     * Xin một mã đặt lại rồi moi mã THÔ ra.
     *
     * CSDL chỉ giữ bản băm nên không đọc ngược được — phải lấy từ liên kết mà
     * `forgotPassword()` ghi vào log ở môi trường kiểm thử. Đây cũng chính là đường
     * người dùng thật đi qua (họ nhận liên kết đó trong email).
     */
    private function layMaDatLai(User $user): string
    {
        $ma = null;
        \Illuminate\Support\Facades\Log::listen(function ($log) use (&$ma) {
            if (preg_match('/token=([a-f0-9]{64})/', $log->message, $khop)) {
                $ma = $khop[1];
            }
        });

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertStatus(200);

        $this->assertNotNull($ma, 'Không lấy được mã đặt lại từ liên kết ghi ở log.');
        return $ma;
    }

    private function datLai(string $email, string $ma, string $matKhauMoi)
    {
        return $this->postJson('/api/auth/reset-password', [
            'email' => $email,
            'token' => $ma,
            'password' => $matKhauMoi,
            'password_confirmation' => $matKhauMoi,
        ]);
    }
}
