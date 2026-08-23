<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\Category;
use App\Models\Product;
use App\Models\Order;
use App\Models\OrderDetail;
use App\Models\Package;
use App\Models\Subscription;
use App\Models\TimeSubscription;
use App\Models\User;
use App\Services\ConsultKnowledgeService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

/**
 * Trợ lý TƯ VẤN ở trang công khai.
 *
 * Điều thật sự cần bảo vệ ở đây KHÔNG phải "AI trả lời hay không", mà là RANH GIỚI:
 * một hộp chat mở cho cả người chưa đăng nhập, nhưng số liệu kinh doanh của quán
 * thì không được rời khỏi CSDL nếu gói không bật can_use_ai.
 *
 * Chốt chặn nằm ở chỗ nào gọi hàm nào, không nằm ở lời dặn cho AI:
 *   · tuyến công khai  -> ConsultKnowledgeService (chỉ bảng gói, không truy vấn quán)
 *   · tuyến trả phí    -> AiController::shopContext (có doanh thu, bàn, thực đơn)
 * Nên các bài dưới đây soi thẳng vào LỜI DẪN được gửi lên Gemini, chứ không soi câu
 * trả lời — câu trả lời do mô hình sinh ra, không phải thứ kiểm thử bám vào được.
 *
 * Bài `..._van_nap_so_lieu_that` là cặp đối chứng: nếu bỏ nó đi thì bài chống rò rỉ
 * vẫn xanh ngay cả khi ngữ cảnh rỗng vì một lý do vớ vẩn nào đó, tức là xanh giả.
 */
class AiConsultTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'shops', 'packages', 'time_subscriptions', 'subscriptions',
        'categories', 'products', 'tables', 'orders', 'order_details',
    ];

    /** Tên món cố ý dị thường để không thể trùng ngẫu nhiên với chữ trong lời dẫn. */
    private const MON_BI_MAT = 'Trà đào cam sả ZZBIMAT';
    private const DOANH_THU = 247_000;

    private User $user;
    private Shop $shop;
    private Package $pro;
    private Package $proMax;

    protected function setUp(): void
    {
        parent::setUp();

        config(['funcafe.gemini_key' => 'khoa-gia-de-kiem-thu']);

        $this->pro = Package::create([
            'name' => 'Pro', 'type' => 'pro', 'level' => 1, 'status' => 'active',
            'is_trial' => false, 'can_use_ai' => false,
            'max_tables' => 20, 'max_menu_items' => 40,
            'description' => 'Đầy đủ chức năng + doanh thu',
            'features' => ['Tối đa 20 bàn', 'Thực đơn tối đa 40 món'],
        ]);

        $this->proMax = Package::create([
            'name' => 'Pro Max', 'type' => 'promax', 'level' => 2, 'status' => 'active',
            'is_trial' => false, 'can_use_ai' => true,
            'max_tables' => null, 'max_menu_items' => null,
            'description' => 'Không giới hạn + trợ lý AI',
            'features' => ['Không giới hạn bàn & thực đơn', 'Trợ lý AI'],
        ]);

        TimeSubscription::create([
            'package_id' => (string) $this->pro->id, 'duration_value' => 1,
            'duration_unit' => 'month', 'price' => 199_000, 'label' => '1 tháng', 'status' => 'active',
        ]);
        TimeSubscription::create([
            'package_id' => (string) $this->proMax->id, 'duration_value' => 1,
            'duration_unit' => 'month', 'price' => 499_000, 'label' => '1 tháng', 'status' => 'active',
        ]);

        // Chủ quán đang dùng gói Pro và ĐÃ xài hết lượt dùng thử — đúng nhóm mà lời
        // mời phải là "nâng lên Pro Max", tuyệt đối không phải "kích hoạt Fun Free".
        $this->user = User::create([
            'full_name' => 'Chủ quán kiểm thử',
            'email' => 'tuvan-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user', 'status' => 'active',
            'has_used_free_trial' => true,
        ]);

        $this->shop = $this->user->shops()->create([
            'name' => 'Quán kiểm thử', 'status' => 'open', 'has_used_free_trial' => true,
        ]);

        Subscription::create([
            'shop_id' => (string) $this->shop->id,
            'package_id' => (string) $this->pro->id,
            'package_name_snapshot' => 'Pro',
            'start_date' => now()->subDays(10),
            'end_date' => now()->addDays(20),
            'total_amount' => 199_000,
            'status' => 'active',
        ]);

        $this->taoDuLieuBanHang();
    }

    /** Dựng dữ liệu THẬT để có cái mà rò rỉ — không có nó thì bài chống rò rỉ vô nghĩa. */
    private function taoDuLieuBanHang(): void
    {
        $shopId = (string) $this->shop->id;

        $category = Category::create(['shop_id' => $shopId, 'name' => 'Trà', 'is_active' => true]);

        $product = Product::create([
            'shop_id' => $shopId,
            'category_id' => (string) $category->id,
            'name' => self::MON_BI_MAT,
            'base_price' => self::DOANH_THU,
            'is_available' => true,
        ]);

        $this->shop->tables()->create(['name' => 'Bàn 1', 'status' => 'available']);

        $order = Order::create([
            'shop_id' => $shopId,
            'status' => 'paid',
            'payment_status' => 'paid',
            'total_amount' => self::DOANH_THU,
            'paid_at' => now(),
        ]);

        OrderDetail::create([
            'order_id' => (string) $order->id,
            'product_id' => (string) $product->id,
            'product_name_snapshot' => self::MON_BI_MAT,
            'quantity' => 1,
            'unit_price' => self::DOANH_THU,
            'total_price' => self::DOANH_THU,
        ]);
    }

    /** Chặn mọi lời gọi ra Gemini và trả câu giả — kiểm thử không được đốt hạn ngạch thật. */
    private function giaLapGemini(string $traLoi = 'Dạ mình xin tư vấn ạ.'): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [['content' => ['parts' => [['text' => $traLoi]]]]],
            ], 200),
        ]);
    }

    /** Lời dẫn (system_instruction) THẬT SỰ được gửi lên Gemini ở lượt gọi gần nhất. */
    private function loiDanDaGui(): string
    {
        $chu = '';
        Http::assertSent(function ($request) use (&$chu) {
            $parts = $request->data()['system_instruction']['parts'] ?? [];
            foreach ($parts as $p) {
                $chu .= $p['text'] ?? '';
            }
            return true;
        });

        return $chu;
    }

    // ---------------------------------------------------------------- mở cửa

    public function test_khach_vang_lai_hoi_duoc_ma_khong_can_dang_nhap(): void
    {
        $this->giaLapGemini('Dạ gói Pro giới hạn 20 bàn ạ.');

        $this->postJson('/api/ai/consult', [
            'messages' => [['role' => 'user', 'content' => 'Gói Pro cho tối đa bao nhiêu bàn?']],
        ])
            ->assertStatus(200)
            ->assertJsonStructure(['reply']);
    }

    // ------------------------------------------------------- trần độ dài tin

    /**
     * HỎI SANG CÂU THỨ HAI PHẢI TRÔI.
     *
     * Đây là bài sinh ra từ một lỗi đã gặp thật. Luật cũ dùng chung
     * `messages.*.content => max:1000`, mà dấu `*` áp cho CẢ tin của trợ lý — trong
     * khi frontend bắt buộc gửi lại lịch sử hội thoại để mô hình nhớ ngữ cảnh. Câu
     * trả lời của trợ lý thường dài hơn 1000 ký tự, nên hỏi câu đầu thì trôi, hỏi câu
     * thứ hai là 422 ngay tại `messages.1` — chính là câu do hệ thống này sinh ra.
     */
    public function test_cau_tra_loi_dai_cua_tro_ly_khong_chan_luot_hoi_tiep_theo(): void
    {
        $this->giaLapGemini('Dạ được ạ.');

        $this->postJson('/api/ai/consult', [
            'messages' => [
                ['role' => 'user', 'content' => 'Gói Pro bao nhiêu bàn?'],
                ['role' => 'assistant', 'content' => str_repeat('Gói Pro cho tối đa 20 bàn. ', 120)], // ~3.240 ký tự
                ['role' => 'user', 'content' => 'Còn Pro Max thì sao?'],
            ],
        ])->assertStatus(200)->assertJsonStructure(['reply']);
    }

    /**
     * ĐỐI CHỨNG. Nới trần cho trợ lý không được nới luôn cho người hỏi — trần 1000 ký
     * tự sinh ra để chặn người lạ dán cả bài văn vào đốt hạn mức của nhà cung cấp, và
     * tuyến này thì ai trên mạng cũng gọi được.
     */
    public function test_cau_hoi_qua_dai_cua_nguoi_dung_van_bi_tu_choi(): void
    {
        $this->giaLapGemini();

        $this->postJson('/api/ai/consult', [
            'messages' => [['role' => 'user', 'content' => str_repeat('a', 1001)]],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('messages.0.content');
    }

    // ------------------------------------------------- ranh giới dữ liệu quán

    /**
     * Chốt chặn quan trọng nhất của cả tính năng.
     *
     * Không kiểm câu trả lời của mô hình mà kiểm NGỮ CẢNH gửi đi: dữ liệu không có
     * trong ngữ cảnh thì mô hình không có cách nào nói ra, kể cả khi bị dụ.
     */
    public function test_loi_dan_cong_khai_khong_chua_bat_ky_so_lieu_nao_cua_quan(): void
    {
        $this->giaLapGemini();

        $this->postJson('/api/ai/consult', [
            'messages' => [['role' => 'user', 'content' => 'Doanh thu quán tôi hôm nay bao nhiêu?']],
        ])->assertStatus(200);

        $loiDan = $this->loiDanDaGui();

        $this->assertStringNotContainsString(self::MON_BI_MAT, $loiDan,
            'Tên món trong thực đơn của quán đã lọt vào ngữ cảnh công khai.');
        $this->assertStringNotContainsString(number_format(self::DOANH_THU, 0, ',', '.'), $loiDan,
            'Số tiền doanh thu của quán đã lọt vào ngữ cảnh công khai.');
        $this->assertStringNotContainsString('Doanh thu hôm nay', $loiDan);
        $this->assertStringNotContainsString('Tình hình bán hàng', $loiDan);
        $this->assertStringNotContainsString('Tổng số bàn', $loiDan);
        $this->assertStringNotContainsString($this->shop->name, $loiDan,
            'Ngay cả TÊN quán cũng không nên có mặt — tuyến này không biết khách là quán nào.');
    }

    /**
     * Đối chứng: tuyến TRẢ PHÍ vẫn phải nạp đủ số liệu.
     *
     * Không có bài này thì bài trên xanh cả khi ngữ cảnh rỗng vì lỗi khác, và ta
     * tưởng đang được bảo vệ trong khi thật ra tính năng đã hỏng.
     */
    public function test_tuyen_tra_phi_van_nap_so_lieu_that_cua_quan(): void
    {
        Subscription::where('shop_id', (string) $this->shop->id)
            ->update(['package_id' => (string) $this->proMax->id]);

        $this->giaLapGemini();
        Sanctum::actingAs($this->user);

        $this->postJson("/api/shops/{$this->shop->id}/ai/chat", [
            'messages' => [['role' => 'user', 'content' => 'Doanh thu hôm nay bao nhiêu?']],
        ])->assertStatus(200);

        $loiDan = $this->loiDanDaGui();

        $this->assertStringContainsString('Doanh thu hôm nay', $loiDan);
        $this->assertStringContainsString(number_format(self::DOANH_THU, 0, ',', '.'), $loiDan);
        $this->assertStringContainsString(self::MON_BI_MAT, $loiDan);
    }

    /** Nới tay tuyến trả phí là mất luôn lý do tồn tại của gói Pro Max. */
    public function test_tuyen_ai_tra_phi_van_chan_goi_pro(): void
    {
        Sanctum::actingAs($this->user);

        $this->postJson("/api/shops/{$this->shop->id}/ai/chat", [
            'messages' => [['role' => 'user', 'content' => 'Doanh thu hôm nay bao nhiêu?']],
        ])->assertStatus(403);
    }

    // ------------------------------------------------------------- lời mời

    public function test_chu_quan_goi_pro_duoc_moi_nang_cap_chu_khong_moi_dung_thu(): void
    {
        $this->giaLapGemini();
        Sanctum::actingAs($this->user);

        $this->postJson('/api/ai/consult', [
            'messages' => [['role' => 'user', 'content' => 'Quán tôi món nào bán chạy nhất?']],
        ])->assertStatus(200);

        $loiDan = $this->loiDanDaGui();

        $this->assertStringContainsString('KHÔNG CÒN quyền dùng thử', $loiDan);
        $this->assertStringContainsString('nâng lên gói Pro Max', $loiDan);
    }

    /**
     * Mời một người đã hết lượt đi "kích hoạt Fun Free" là đẩy họ tới một nút bấm
     * chắc chắn bị từ chối (SubscriptionController::store). Ba trạng thái phải tách bạch.
     */
    public function test_nguoi_con_quyen_dung_thu_duoc_moi_fun_free(): void
    {
        $moi = User::create([
            'full_name' => 'Người mới',
            'email' => 'moi-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user', 'status' => 'active',
            'has_used_free_trial' => false,
        ]);

        $this->giaLapGemini();
        Sanctum::actingAs($moi);

        $this->postJson('/api/ai/consult', [
            'messages' => [['role' => 'user', 'content' => 'Tôi muốn thử phần mềm trước khi mua']],
        ])->assertStatus(200);

        $loiDan = $this->loiDanDaGui();

        $this->assertStringContainsString('VẪN CÒN quyền dùng thử', $loiDan);
        $this->assertStringNotContainsString('KHÔNG CÒN quyền dùng thử', $loiDan);
    }

    public function test_khach_chua_dang_nhap_duoc_moi_dang_ky_chu_khong_phai_nang_goi(): void
    {
        $this->giaLapGemini();

        $this->postJson('/api/ai/consult', [
            'messages' => [['role' => 'user', 'content' => 'Phần mềm này dùng thế nào?']],
        ])->assertStatus(200);

        $loiDan = $this->loiDanDaGui();

        $this->assertStringContainsString('CHƯA ĐĂNG NHẬP', $loiDan);
        $this->assertStringContainsString('đăng ký tài khoản', $loiDan);
    }

    // -------------------------------------------------------- bảng gói động

    /**
     * Giá phải đọc từ CSDL. Chép cứng trong mã thì admin sửa giá xong, hộp chat vẫn
     * đọc giá cũ cho khách nghe — sai ở đúng chỗ không được phép sai.
     */
    public function test_bang_goi_doc_gia_tu_csdl_khong_chep_cung(): void
    {
        $kienThuc = app(ConsultKnowledgeService::class);

        $this->assertStringContainsString('199.000đ', $kienThuc->bangGoi());

        $this->pro->update(['max_tables' => 25]);
        TimeSubscription::where('package_id', (string) $this->pro->id)
            ->update(['price' => 259_000]);
        \Illuminate\Support\Facades\Cache::flush();

        $sau = app(ConsultKnowledgeService::class)->bangGoi();
        $this->assertStringContainsString('259.000đ', $sau);
        $this->assertStringContainsString('tối đa 25', $sau);
        $this->assertStringNotContainsString('199.000đ', $sau);
    }

    /** Hạn mức "không giới hạn" phải nói thành chữ, đừng để lọt ra chữ "null". */
    public function test_goi_khong_gioi_han_duoc_dien_dat_ro_rang(): void
    {
        $bang = app(ConsultKnowledgeService::class)->bangGoi();

        $this->assertStringContainsString('không giới hạn', $bang);
        $this->assertStringNotContainsString('null', $bang);
    }

    /**
     * Trợ lý phải nói được cả những thứ phần mềm KHÔNG làm được.
     *
     * Thiếu khối câu hỏi thường gặp thì mô hình không có dữ liệu cho mấy câu này, và
     * nó sẽ suy diễn ra một tính năng không tồn tại — khách phát hiện ngay ngày đầu
     * dùng thử. Riêng câu hóa đơn điện tử là chỗ dễ hứa hão nhất: nghe "in hóa đơn"
     * thì rất dễ tưởng là phát hành được hóa đơn đỏ.
     */
    public function test_loi_dan_noi_ro_cac_gioi_han_that_cua_san_pham(): void
    {
        $loiDan = app(ConsultKnowledgeService::class)->loiDan(null);

        // Không phát hành hóa đơn điện tử — thứ in ra chỉ là phiếu tính tiền.
        $this->assertStringContainsString('PHIẾU TÍNH TIỀN', $loiDan);
        $this->assertStringContainsString('123/2020', $loiDan);

        // Ba giới hạn còn lại, đều là câu khách hỏi trước khi xuống tiền.
        $this->assertStringContainsString('Mất mạng', $loiDan);
        $this->assertStringContainsString('tồn kho', $loiDan);
        $this->assertStringContainsString('phân quyền theo', $loiDan);
    }
}
