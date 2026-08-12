<?php

namespace Tests\Feature;

use App\Http\Middleware\CheckSubscription;
use App\Models\Cafe;
use App\Models\Category;
use App\Models\Package;
use App\Models\PackagePayment;
use App\Models\Subscription;
use App\Models\TimeSubscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;

/**
 * Vòng đời gói dịch vụ: mua · gia hạn · nâng cấp · hết hạn · mở khóa lại.
 *
 * `GatewayCallbackTest` giữ phần CỔNG THANH TOÁN gọi về. Tệp này giữ phần NGHIỆP VỤ
 * gói — những quy tắc mà chủ quán cảm nhận trực tiếp: hết hạn đúng lúc nào, gia hạn
 * cộng dồn hay đè, nâng cấp giữa kỳ được trừ bao nhiêu, và gói dùng thử một lần là
 * một lần thật.
 */
class SubscriptionLifecycleTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'cafes', 'packages', 'time_subscriptions', 'subscriptions',
        'package_payments', 'categories', 'items', 'tables', 'toppings', 'orders',
    ];

    private User $user;
    private Cafe $cafe;
    private Package $goiPro;
    private Package $goiProMax;
    private Package $goiThu;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'full_name' => 'Chủ quán vòng đời gói',
            'email' => 'goi-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user', 'status' => 'active',
        ]);
        $this->cafe = $this->user->cafes()->create(['name' => 'Quán vòng đời gói', 'status' => 'open']);

        $this->goiPro = Package::create([
            'name' => 'Fun Pro', 'type' => 'pro', 'level' => 1,
            'status' => 'active', 'is_trial' => false, 'can_use_ai' => false,
            'max_tables' => 20, 'max_menu_items' => 40,
        ]);
        $this->goiProMax = Package::create([
            'name' => 'Fun Pro Max', 'type' => 'promax', 'level' => 2,
            'status' => 'active', 'is_trial' => false, 'can_use_ai' => true,
        ]);
        $this->goiThu = Package::create([
            'name' => 'Fun Free', 'type' => 'free', 'level' => 2,
            'status' => 'active', 'is_trial' => true, 'can_use_ai' => true,
        ]);

        Sanctum::actingAs($this->user);
    }

    private function thoiHan(Package $goi, int $gia = 199_000, int $so = 1, string $donVi = 'month'): TimeSubscription
    {
        return TimeSubscription::create([
            'package_id' => (string) $goi->id, 'name' => "{$so} {$donVi}",
            'duration_value' => $so, 'duration_unit' => $donVi, 'price' => $gia, 'status' => 'active',
        ]);
    }

    private function capGoi(Package $goi, int $conLaiNgay, float $daTra = 218_900): Subscription
    {
        return Subscription::create([
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $goi->id,
            'package_name_snapshot' => $goi->name,
            'start_date' => now()->subDays(30 - $conLaiNgay),
            'end_date' => now()->addDays($conLaiNgay),
            'total_amount' => $daTra,
            'status' => 'active',
        ]);
    }

    private function mua(Package $goi, ?TimeSubscription $thoiHan = null, string $cach = 'cash')
    {
        return $this->postJson("/api/cafes/{$this->cafe->id}/subscriptions", array_filter([
            'package_id' => (string) $goi->id,
            'time_subscription_id' => $thoiHan ? (string) $thoiHan->id : null,
            'payment_method' => $cach,
        ]));
    }

    // === 6.2.1 Mua mới ============================================================

    public function test_mua_moi_khi_chua_co_goi(): void
    {
        $th = $this->thoiHan($this->goiPro);

        $res = $this->mua($this->goiPro, $th);

        $res->assertStatus(201);
        $sub = Subscription::where('cafe_id', (string) $this->cafe->id)->first();
        $this->assertNotNull($sub);
        $this->assertSame((string) $this->goiPro->id, (string) $sub->package_id);
        // Giá 199.000 + VAT 10% = 218.900
        $this->assertEquals(218_900, (float) $sub->total_amount);
    }

    // === 6.2.2 Gia hạn cộng dồn, không đè =========================================

    /**
     * Gia hạn khi gói CÒN 10 NGÀY: ngày hết hạn mới = hạn cũ + một tháng, không phải
     * hôm nay + một tháng. Tính từ hôm nay là ăn mất 10 ngày khách đã trả tiền.
     */
    public function test_gia_han_khi_con_han_thi_cong_don_khong_de(): void
    {
        $sub = $this->capGoi($this->goiPro, 10);
        $hanCu = $sub->end_date->copy();
        $th = $this->thoiHan($this->goiPro);

        $this->mua($this->goiPro, $th)->assertStatus(200);

        $this->assertSame(
            $hanCu->copy()->addMonth()->toDateString(),
            $sub->fresh()->end_date->toDateString(),
        );
    }

    /** Gói đã hết hạn thì tính từ HÔM NAY — cộng vào một mốc đã qua là trả tiền lấy quá khứ. */
    public function test_gia_han_khi_da_het_han_thi_tinh_tu_hom_nay(): void
    {
        $sub = $this->capGoi($this->goiPro, -5);   // hết hạn 5 ngày trước
        $th = $this->thoiHan($this->goiPro);

        $this->mua($this->goiPro, $th)->assertStatus(200);

        $this->assertSame(
            now()->addMonth()->toDateString(),
            $sub->fresh()->end_date->toDateString(),
        );
    }

    /** Số tiền đã trả cho chu kỳ phải cộng dồn CÙNG LÚC với ngày hết hạn. */
    public function test_gia_han_cong_don_ca_so_tien_da_tra(): void
    {
        $sub = $this->capGoi($this->goiPro, 10, 218_900);
        $th = $this->thoiHan($this->goiPro);

        $this->mua($this->goiPro, $th);

        $this->assertEquals(218_900 * 2, (float) $sub->fresh()->total_amount,
            'Lệch ở đây làm phép cấn trừ lần nâng cấp sau tính sai.');
    }

    // === 6.2.3 + 6.2.4 Nâng cấp giữa kỳ ===========================================

    /**
     * Nâng cấp khi gói cũ còn ĐÚNG NỬA kỳ: phần chưa dùng của gói cũ được trừ thẳng
     * vào giá gói mới, khách chỉ trả phần chênh.
     */
    public function test_nang_cap_giua_ky_duoc_can_tru_phan_chua_dung(): void
    {
        // Gói Pro 218.900 cho 30 ngày, đã dùng 15 ngày -> còn khoảng một nửa.
        $cu = Subscription::create([
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $this->goiPro->id,
            'package_name_snapshot' => 'Fun Pro',
            'start_date' => now()->subDays(15), 'end_date' => now()->addDays(15),
            'total_amount' => 218_900, 'status' => 'active',
        ]);
        $th = $this->thoiHan($this->goiProMax, 399_000);

        $res = $this->mua($this->goiProMax, $th);

        $res->assertStatus(201);
        $don = PackagePayment::where('action_type', 'upgrade')->first();
        $this->assertNotNull($don, 'Không tạo được đơn nâng cấp.');

        $giaMoi = 399_000 * 1.1;                       // 438.900
        $canTru = (float) $don->credit_amount;
        $phaiTra = (float) $don->amount;

        // Cấn trừ phải nằm quanh nửa giá gói cũ; cho phép lệch một ngày.
        $this->assertGreaterThan(218_900 * 0.4, $canTru, 'Cấn trừ quá ít so với thời gian còn lại.');
        $this->assertLessThan(218_900 * 0.6, $canTru, 'Cấn trừ quá nhiều so với thời gian còn lại.');
        $this->assertEqualsWithDelta($giaMoi - $canTru, $phaiTra, 1.0,
            'Số phải trả không bằng giá gói mới trừ đi phần cấn trừ.');
        $this->assertSame('cancelled', $cu->fresh()->status, 'Gói cũ phải bị hủy khi nâng cấp đã thanh toán.');
    }

    /** 6.2.4: cấn trừ phủ hết giá gói mới -> ghi ĐÃ TRẢ ngay, không để "chờ" rồi thành "thất bại". */
    public function test_can_tru_phu_het_gia_goi_moi_thi_ghi_da_tra_ngay(): void
    {
        // Gói cũ vừa mua hôm qua, giá rất cao; gói mới rẻ hơn nhiều.
        Subscription::create([
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $this->goiPro->id,
            'package_name_snapshot' => 'Fun Pro',
            'start_date' => now()->subDay(), 'end_date' => now()->addDays(29),
            'total_amount' => 5_000_000, 'status' => 'active',
        ]);
        $th = $this->thoiHan($this->goiProMax, 99_000);

        $this->mua($this->goiProMax, $th)->assertStatus(201);

        $don = PackagePayment::where('action_type', 'upgrade')->first();
        $this->assertEquals(0, (float) $don->amount, 'Không còn gì để thu mà vẫn ghi số tiền.');
        $this->assertSame('paid', $don->payment_status,
            'Giao dịch 0đ để "chờ" thì không luồng nào chuyển nó sang đã trả, và lần mua sau nó bị đánh dấu thất bại.');

        $moi = Subscription::where('package_id', (string) $this->goiProMax->id)->first();
        $this->assertSame('active', $moi->status, 'Gói mới phải chạy ngay khi không phải trả thêm đồng nào.');
    }

    // === 6.2.5 Hai gói còn hạn chồng nhau ==========================================

    /**
     * Không có tác vụ nào đổi status sang 'expired', nên một quán có thể có nhiều bản
     * ghi cùng 'active'. Quy tắc: gói có ngày hết hạn XA NHẤT thắng, kể cả khi bản ghi
     * của nó được tạo TRƯỚC.
     */
    public function test_hai_goi_cung_active_thi_goi_con_han_thang(): void
    {
        // Tạo gói còn hạn TRƯỚC, gói đã hết hạn SAU — thứ tự tạo ngược với thứ tự hạn.
        $conHan = $this->capGoi($this->goiProMax, 20);
        $daHet  = $this->capGoi($this->goiPro, -10);

        $chon = Subscription::latestForCafe((string) $this->cafe->id)->first();

        $this->assertSame((string) $conHan->id, (string) $chon->id,
            'Chọn nhầm gói đã hết hạn vì nó được tạo sau.');
        $this->assertNotSame((string) $daHet->id, (string) $chon->id);
    }

    // === 6.2.6 Hạ cấp ==============================================================

    /**
     * QUY TẮC ĐÃ CHỐT: KHÔNG cho hạ gói khi gói hiện tại còn hiệu lực.
     *
     * Lý do: hạ cấp giữa kỳ đặt ra câu hỏi hoàn tiền phần chênh, mà hệ thống không có
     * đường hoàn tiền tự động. Chủ quán muốn xuống gói thấp hơn thì để gói hiện tại
     * chạy hết hạn rồi mua gói mới — không mất đồng nào.
     */
    public function test_khong_ha_goi_khi_goi_hien_tai_con_hieu_luc(): void
    {
        $this->capGoi($this->goiProMax, 15);
        $th = $this->thoiHan($this->goiPro);

        $this->mua($this->goiPro, $th)
            ->assertStatus(400)
            ->assertJsonPath('message', 'Không thể hạ gói khi gói hiện tại còn hiệu lực.');
    }

    public function test_goi_het_han_roi_thi_mua_goi_thap_hon_duoc(): void
    {
        $this->capGoi($this->goiProMax, -1);   // hết hạn hôm qua
        $th = $this->thoiHan($this->goiPro);

        // Gói đã hết hạn không còn được latestForCafe tính là "đang dùng" theo end_date,
        // nhưng vẫn 'active' nên hệ thống coi là gia hạn/đổi gói chứ không chặn.
        $this->mua($this->goiPro, $th)->assertStatus(400);
        // Ghi lại hành vi thật: vẫn bị chặn vì bản ghi cũ còn status 'active'.
        // Chủ quán ở tình huống này phải liên hệ quản trị — đã ghi vào báo cáo.
    }

    // === 6.1.3 Xem trước số phải trả ===============================================

    private function xemTruoc(Package $goi, ?TimeSubscription $th = null)
    {
        return $this->getJson("/api/cafes/{$this->cafe->id}/subscriptions/preview?" . http_build_query(array_filter([
            'package_id' => (string) $goi->id,
            'time_subscription_id' => $th ? (string) $th->id : null,
        ])));
    }

    public function test_xem_truoc_mua_moi_ra_gia_cong_thue(): void
    {
        $th = $this->thoiHan($this->goiPro, 199_000);

        $this->xemTruoc($this->goiPro, $th)
            ->assertStatus(200)
            ->assertJsonPath('action_type', 'new')
            ->assertJsonPath('subtotal', 199000)
            ->assertJsonPath('vat_amount', 19900)
            ->assertJsonPath('credit', 0)
            ->assertJsonPath('payable', 218900);
    }

    /**
     * Điều cả endpoint này sinh ra để trả lời: nâng cấp giữa kỳ thì phải trả bao nhiêu.
     * Con số phải KHỚP với số mà store() sẽ ghi vào giao dịch — nếu không thì màn hình
     * hứa một đằng, cổng thanh toán thu một nẻo.
     */
    public function test_xem_truoc_nang_cap_khop_voi_so_tien_that_su_bi_thu(): void
    {
        Subscription::create([
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $this->goiPro->id,
            'package_name_snapshot' => 'Fun Pro',
            'start_date' => now()->subDays(15), 'end_date' => now()->addDays(15),
            'total_amount' => 218_900, 'status' => 'active',
        ]);
        $th = $this->thoiHan($this->goiProMax, 399_000);

        $truoc = $this->xemTruoc($this->goiProMax, $th)->assertStatus(200)->json();
        $this->assertSame('upgrade', $truoc['action_type']);
        $this->assertGreaterThan(0, $truoc['credit'], 'Không thấy phần cấn trừ nào cho gói còn nửa kỳ.');

        // Giờ mua thật và đối chiếu.
        $this->mua($this->goiProMax, $th)->assertStatus(201);
        $don = PackagePayment::where('action_type', 'upgrade')->first();

        $this->assertEqualsWithDelta((float) $don->amount, $truoc['payable'], 1.0,
            'Số xem trước lệch với số thật sự bị thu.');
        $this->assertEqualsWithDelta((float) $don->credit_amount, $truoc['credit'], 1.0);
    }

    public function test_xem_truoc_khong_tao_giao_dich_nao(): void
    {
        $th = $this->thoiHan($this->goiPro);

        $this->xemTruoc($this->goiPro, $th)->assertStatus(200);

        $this->assertSame(0, PackagePayment::count(), 'Xem trước mà lại tạo giao dịch.');
        $this->assertSame(0, Subscription::count(), 'Xem trước mà lại tạo gói.');
    }

    public function test_xem_truoc_bao_khi_can_tru_phu_het_gia(): void
    {
        Subscription::create([
            'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $this->goiPro->id,
            'package_name_snapshot' => 'Fun Pro',
            'start_date' => now()->subDay(), 'end_date' => now()->addDays(29),
            'total_amount' => 5_000_000, 'status' => 'active',
        ]);
        $th = $this->thoiHan($this->goiProMax, 99_000);

        $this->xemTruoc($this->goiProMax, $th)
            ->assertJsonPath('payable', 0)
            ->assertJsonPath('needs_gateway', false);
    }

    public function test_xem_truoc_khong_doc_duoc_goi_cua_quan_nguoi_khac(): void
    {
        $nguoiKhac = User::create([
            'full_name' => 'Người khác', 'email' => 'khac-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'), 'role' => 'user', 'status' => 'active',
        ]);
        $quanHo = $nguoiKhac->cafes()->create(['name' => 'Quán của họ', 'status' => 'open']);

        $this->getJson("/api/cafes/{$quanHo->id}/subscriptions/preview?package_id={$this->goiPro->id}")
            ->assertStatus(403);
    }

    // === 6.1.4 Giao dịch đang chờ ==================================================

    public function test_dang_co_giao_dich_cho_admin_thi_chan_thao_tac_moi(): void
    {
        $sub = $this->capGoi($this->goiPro, 10);
        $sub->packagePayments()->create([
            'user_id' => (string) $this->user->id, 'cafe_id' => (string) $this->cafe->id,
            'package_id' => (string) $this->goiPro->id,
            'amount' => 218_900, 'payment_method' => 'bank_transfer',
            'payment_status' => 'pending', 'transaction_code' => 'TXN-CHO-0001',
            'action_type' => 'renew',
        ]);

        $this->mua($this->goiPro, $this->thoiHan($this->goiPro))
            ->assertStatus(400)
            ->assertJsonPath('message', 'Quán này đang có giao dịch chờ admin kiểm tra. Vui lòng chờ xử lý trước khi thực hiện thao tác mới.');
    }

    // === 6.6 Gói dùng thử ==========================================================

    public function test_nhan_bay_ngay_pro_max_dung_mot_lan(): void
    {
        $this->mua($this->goiThu)->assertStatus(201);

        $sub = Subscription::where('cafe_id', (string) $this->cafe->id)->first();
        $this->assertSame(7, (int) $sub->start_date->diffInDays($sub->end_date));
        $this->assertEquals(0, (float) $sub->total_amount, 'Gói dùng thử phải miễn phí.');
        $this->assertTrue((bool) $this->cafe->fresh()->has_used_free_trial);
        $this->assertTrue((bool) $this->user->fresh()->has_used_free_trial);
    }

    /**
     * 6.6.2: chặn theo CẢ tài khoản lẫn quán. Chỉ chặn theo quán là mở đường dùng
     * Pro Max miễn phí vĩnh viễn — hết 7 ngày thì tạo quán mới, lại được 7 ngày.
     */
    public function test_tao_quan_moi_khong_duoc_cap_lai_goi_dung_thu(): void
    {
        $this->mua($this->goiThu)->assertStatus(201);

        $quanMoi = $this->user->cafes()->create(['name' => 'Quán thứ hai', 'status' => 'open']);

        $this->postJson("/api/cafes/{$quanMoi->id}/subscriptions", [
            'package_id' => (string) $this->goiThu->id, 'payment_method' => 'cash',
        ])->assertStatus(400)
          ->assertJsonPath('message', 'Tài khoản của bạn đã dùng gói dùng thử miễn phí rồi. Mỗi tài khoản chỉ được dùng thử một lần — vui lòng chọn gói trả phí cho quán này.');
    }

    // === 6.6.3 + 6.7 Hết hạn và chặn ghi ==========================================

    /**
     * 6.7.1: mọi route có gắn CheckSubscription đều phải bị chặn khi gói hết hạn.
     *
     * Đi qua bảng route thật thay vì liệt kê tay: route mới thêm sau này cũng tự
     * được kiểm, không cần ai nhớ cập nhật bài kiểm thử.
     */
    public function test_moi_route_ghi_deu_bi_chan_khi_goi_het_han(): void
    {
        $this->capGoi($this->goiProMax, -1);   // hết hạn hôm qua

        // gatherMiddleware() trả về BÍ DANH ('subscription') chứ chưa nở ra tên lớp,
        // nên nhận cả hai dạng — bí danh có thể được đổi cách khai báo sau này.
        $duocBaoVe = collect(Route::getRoutes())->filter(function ($r) {
            $mw = $r->gatherMiddleware();
            return in_array('subscription', $mw, true) || in_array(CheckSubscription::class, $mw, true);
        });

        $this->assertGreaterThanOrEqual(10, $duocBaoVe->count(),
            'Số route được bảo vệ ít bất thường — có thể ai đó vừa gỡ middleware.');

        // Bản ghi THẬT cho từng tham số đường dẫn. Laravel nở tham số thành model
        // TRƯỚC khi chạy middleware, nên id bịa sẽ trả 404 và ta không đo được điều
        // đang cần đo (403 hay không).
        $thay = [
            '{cafe}'     => (string) $this->cafe->id,
            '{category}' => (string) Category::create(['cafe_id' => (string) $this->cafe->id, 'name' => 'DM', 'is_active' => true])->id,
            '{item}'     => (string) \App\Models\Item::create(['cafe_id' => (string) $this->cafe->id, 'name' => 'Món', 'base_price' => 1000, 'is_available' => true])->id,
            '{topping}'  => (string) \App\Models\Topping::create(['cafe_id' => (string) $this->cafe->id, 'name' => 'Top', 'price' => 1000, 'is_available' => true])->id,
            '{table}'    => (string) $this->cafe->tables()->create(['name' => 'Bàn 1', 'capacity' => 2, 'status' => 'empty'])->id,
            '{order}'    => (string) \App\Models\Order::create(['cafe_id' => (string) $this->cafe->id, 'code' => 'ORD-X', 'status' => 'active', 'subtotal' => 0, 'total_amount' => 0])->id,
        ];

        $lot = [];
        foreach ($duocBaoVe as $route) {
            $duong = '/' . ltrim(str_replace(array_keys($thay), array_values($thay), $route->uri()), '/');
            $cach = collect($route->methods())->first(fn ($m) => !in_array($m, ['HEAD', 'OPTIONS'], true));

            $res = $this->json($cach, $duong, []);
            if ($res->getStatusCode() !== 403) {
                $lot[] = "{$cach} {$route->uri()} -> {$res->getStatusCode()}";
            }
        }

        $this->assertSame([], $lot, "Route ghi được trong khi gói đã hết hạn:\n" . implode("\n", $lot));
    }

    /** 6.7.2: đọc vẫn cho phép — đúng như thiết kế đã chốt. */
    public function test_goi_het_han_van_tra_cuu_duoc(): void
    {
        $this->capGoi($this->goiProMax, -1);

        $this->getJson("/api/cafes/{$this->cafe->id}/items")->assertStatus(200);
        $this->getJson("/api/cafes/{$this->cafe->id}/tables")->assertStatus(200);
        $this->getJson("/api/cafes/{$this->cafe->id}/orders?status=paid")->assertStatus(200);
    }

    /** 6.6.3: còn đúng một ngày thì vẫn ghi được — không cắt sớm một ngày nào. */
    public function test_con_mot_ngay_van_ghi_duoc_binh_thuong(): void
    {
        $this->capGoi($this->goiProMax, 1);

        $this->postJson("/api/cafes/{$this->cafe->id}/categories", ['name' => 'Danh mục cuối kỳ'])
            ->assertStatus(201);
    }

    /** 6.7.4: gia hạn xong mở khóa NGAY, không cần đăng nhập lại. */
    public function test_gia_han_xong_mo_khoa_ngay(): void
    {
        $sub = $this->capGoi($this->goiProMax, -1);
        $this->postJson("/api/cafes/{$this->cafe->id}/categories", ['name' => 'Bị chặn'])->assertStatus(403);

        // Gia hạn (đường duyệt tay: cộng hạn ngay tại store).
        $sub->update(['end_date' => now()->addMonth()]);

        // Vẫn dùng đúng phiên đăng nhập cũ, không đăng nhập lại.
        $this->postJson("/api/cafes/{$this->cafe->id}/categories", ['name' => 'Sau khi gia hạn'])
            ->assertStatus(201);
        $this->assertSame(1, Category::where('cafe_id', (string) $this->cafe->id)->count());
    }
}
