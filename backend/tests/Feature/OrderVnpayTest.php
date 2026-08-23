<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\Category;
use App\Models\Product;
use App\Models\Order;
use App\Models\Package;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * THU TIỀN BÁN HÀNG QUA VNPAY — khách quét mã QR bằng điện thoại của họ.
 *
 * Đây là chỗ nguy hiểm nhất trong toàn hệ thống: một callback đến từ bên ngoài, không
 * qua đăng nhập, và nó ĐỔI TRẠNG THÁI TIỀN. Bốn điều phải khoá lại:
 *
 *  1. Sai chữ ký -> từ chối. Không có chốt này thì ai cũng gọi được IPN để chốt
 *     khống một đơn mà không trả đồng nào.
 *  2. Sai số tiền -> từ chối. Thiếu chốt này thì trả 1.000đ chốt được hóa đơn 500.000đ.
 *  3. Gọi hai lần -> chỉ chốt một lần, một mã phiếu. VNPay gọi lại IPN là chuyện
 *     bình thường của cổng, không phải sự cố.
 *  4. Khách hủy -> đơn KHÔNG bị hủy theo, chỉ đánh dấu trả tiền hỏng. Món đã pha rồi
 *     và khách vẫn đang đứng ở quầy để trả cách khác.
 */
class OrderVnpayTest extends MongoTestCase
{
    protected array $collections = [
        'users', 'shops', 'packages', 'subscriptions', 'categories',
        'products', 'product_sizes', 'toppings', 'tables', 'orders',
        'order_details', 'order_detail_toppings',
    ];

    private User $user;
    private Shop $shop;
    private Product $product;
    private $table;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.vnpay.tmn_code', 'TESTTMN');
        config()->set('services.vnpay.hash_secret', 'BIMATKIEMTHU');
        config()->set('services.vnpay.url', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');

        $this->user = User::create([
            'full_name' => 'Chủ quán VNPay',
            'email' => 'vnpay-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'),
            'role' => 'user',
            'status' => 'active',
        ]);
        $this->shop = $this->user->shops()->create(['name' => 'Quán VNPay', 'status' => 'open']);

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

        $category = Category::create([
            'shop_id' => (string) $this->shop->id, 'name' => 'Cà phê', 'is_active' => true,
        ]);
        $this->product = Product::create([
            'shop_id' => (string) $this->shop->id,
            'category_id' => (string) $category->id,
            'name' => 'Cà phê sữa',
            'base_price' => 30_000,
            'is_available' => true,
        ]);
        $this->table = $this->shop->tables()->create([
            'name' => 'Bàn 1', 'capacity' => 4, 'status' => 'empty', 'is_active' => true,
        ]);

        Sanctum::actingAs($this->user);
    }

    /** Mở một đơn tại quán 2 ly = 60.000. */
    private function taoDon(): string
    {
        return $this->postJson("/api/shops/{$this->shop->id}/orders", [
            'table_id' => (string) $this->table->id,
            'items' => [[
                'product_id' => (string) $this->product->id,
                'product_name_snapshot' => 'Cà phê sữa',
                'quantity' => 2,
            ]],
        ])->json('id');
    }

    private function xinLienKet(string $orderId)
    {
        return $this->postJson("/api/shops/{$this->shop->id}/orders/{$orderId}/vnpay");
    }

    /**
     * Dựng đúng chữ ký như VNPay làm: sort khóa, urlencode, HMAC-SHA512.
     * Ký bằng chính bí mật đã đặt ở setUp.
     */
    private function callbackVnpay(array $ghiDe = []): array
    {
        $data = array_merge([
            'vnp_Amount'         => 60_000 * 100,
            'vnp_BankCode'       => 'NCB',
            'vnp_ResponseCode'   => '00',
            'vnp_TransactionNo'  => '14012345',
            'vnp_TxnRef'         => 'THIEU',
        ], $ghiDe);

        ksort($data);
        $chuoi = implode('&', array_map(
            fn ($k, $v) => urlencode((string) $k) . '=' . urlencode((string) $v),
            array_keys($data),
            $data,
        ));
        $data['vnp_SecureHash'] = hash_hmac('sha512', $chuoi, 'BIMATKIEMTHU');

        return $data;
    }

    // --- Dựng liên kết ----------------------------------------------------------

    public function test_dung_duoc_lien_ket_vnpay_cho_don_dang_phuc_vu(): void
    {
        $id = $this->taoDon();
        $res = $this->xinLienKet($id)->assertStatus(200);

        $this->assertStringStartsWith('https://sandbox.vnpayment.vn/', $res->json('pay_url'));
        $this->assertSame(60_000, $res->json('amount'));
        $this->assertNotEmpty($res->json('txn_ref'));

        $don = Order::find($id);
        $this->assertSame($res->json('txn_ref'), $don->gateway_txn_ref);
        $this->assertSame('pending', $don->payment_status);
        $this->assertSame('active', $don->status, 'Chưa trả tiền thì đơn vẫn đang phục vụ.');
    }

    /**
     * Khách quét rồi bỏ ngang, thu ngân bấm lại: phải ra mã MỚI.
     * Dùng lại mã cũ thì VNPay coi là giao dịch trùng và từ chối.
     */
    public function test_bam_lai_thi_sinh_ma_tham_chieu_moi(): void
    {
        $id = $this->taoDon();
        $a = $this->xinLienKet($id)->json('txn_ref');
        $b = $this->xinLienKet($id)->json('txn_ref');

        $this->assertNotSame($a, $b);
        $this->assertSame($b, Order::find($id)->gateway_txn_ref, 'Chỉ mã mới nhất có hiệu lực.');
    }

    public function test_khong_dung_lien_ket_cho_don_da_thanh_toan(): void
    {
        $id = $this->taoDon();
        $this->postJson("/api/shops/{$this->shop->id}/orders/{$id}/pay", [
            'payment_method' => 'cash', 'cash_received' => 100_000,
        ])->assertStatus(200);

        $this->xinLienKet($id)->assertStatus(400);
    }

    public function test_khong_dung_lien_ket_cho_don_cua_quan_khac(): void
    {
        $nguoiKhac = User::create([
            'full_name' => 'Chủ khác', 'email' => 'khac-' . uniqid() . '@funcafe.test',
            'password' => Hash::make('Password@123'), 'role' => 'user', 'status' => 'active',
        ]);
        $quanKhac = $nguoiKhac->shops()->create(['name' => 'Quán khác', 'status' => 'open']);
        $id = $this->taoDon();

        $this->postJson("/api/shops/{$quanKhac->id}/orders/{$id}/vnpay")->assertStatus(403);
    }

    // --- IPN: bốn chốt chặn -----------------------------------------------------

    public function test_ipn_sai_chu_ky_bi_tu_choi_va_khong_chot_don(): void
    {
        $id = $this->taoDon();
        $ref = $this->xinLienKet($id)->json('txn_ref');

        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref]);
        $du['vnp_SecureHash'] = str_repeat('0', 128);          // chữ ký bịa

        $this->getJson('/api/payments/vnpay/order/ipn?' . http_build_query($du))
            ->assertStatus(200)->assertJsonPath('RspCode', '97');

        $this->assertSame('active', Order::find($id)->status, 'Đơn KHÔNG được chốt.');
    }

    public function test_ipn_sai_so_tien_bi_tu_choi_va_khong_chot_don(): void
    {
        $id = $this->taoDon();
        $ref = $this->xinLienKet($id)->json('txn_ref');

        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref, 'vnp_Amount' => 1_000 * 100]);

        $this->getJson('/api/payments/vnpay/order/ipn?' . http_build_query($du))
            ->assertStatus(200)->assertJsonPath('RspCode', '04');

        $this->assertSame('active', Order::find($id)->status);
    }

    public function test_ipn_ma_tham_chieu_la_bi_tu_choi(): void
    {
        $du = $this->callbackVnpay(['vnp_TxnRef' => 'OD000000000000LAHOAC']);

        $this->getJson('/api/payments/vnpay/order/ipn?' . http_build_query($du))
            ->assertStatus(200)->assertJsonPath('RspCode', '01');
    }

    public function test_ipn_hop_le_chot_don_va_sinh_ma_phieu(): void
    {
        $id = $this->taoDon();
        $ref = $this->xinLienKet($id)->json('txn_ref');

        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref]);
        $this->getJson('/api/payments/vnpay/order/ipn?' . http_build_query($du))
            ->assertStatus(200)->assertJsonPath('RspCode', '00');

        $don = Order::find($id);
        $this->assertSame('paid', $don->status);
        $this->assertSame('paid', $don->payment_status);
        $this->assertSame('vnpay', $don->payment_method);
        $this->assertNotEmpty($don->invoice_code);
        $this->assertSame(60_000, (int) $don->total_amount);
        // Thu qua cổng thì không thu ngân nào cầm tiền.
        $this->assertNull($don->paid_by);
        $this->assertNull($don->cash_received);
    }

    /** Thanh toán xong thì bàn phải về TRỐNG, y như thu tiền mặt. */
    public function test_ipn_hop_le_tra_ban_ve_trong(): void
    {
        $id = $this->taoDon();
        $this->assertSame('serving', $this->table->fresh()->status);

        $ref = $this->xinLienKet($id)->json('txn_ref');
        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref]);
        $this->getJson('/api/payments/vnpay/order/ipn?' . http_build_query($du));

        $this->assertSame('empty', $this->table->fresh()->status);
        $this->assertNull($this->table->fresh()->current_order_id);
    }

    /** VNPay gọi lại IPN là chuyện thường của cổng — không được ra hai mã phiếu. */
    public function test_ipn_goi_hai_lan_chi_chot_mot_lan_mot_ma_phieu(): void
    {
        $id = $this->taoDon();
        $ref = $this->xinLienKet($id)->json('txn_ref');
        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref]);
        $url = '/api/payments/vnpay/order/ipn?' . http_build_query($du);

        $this->getJson($url)->assertJsonPath('RspCode', '00');
        $maLan1 = Order::find($id)->invoice_code;

        $this->getJson($url)->assertJsonPath('RspCode', '00');

        $this->assertSame($maLan1, Order::find($id)->invoice_code, 'Mã phiếu không được đổi.');
        $this->assertSame(1, $this->shop->orders()->where('status', 'paid')->count());
    }

    /**
     * Khách bấm hủy trên cổng: đơn KHÔNG bị hủy theo. Món đã pha rồi và khách vẫn
     * đứng ở quầy — thu ngân chuyển sang thu tiền mặt.
     */
    public function test_khach_huy_thi_don_van_con_de_thu_cach_khac(): void
    {
        $id = $this->taoDon();
        $ref = $this->xinLienKet($id)->json('txn_ref');

        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref, 'vnp_ResponseCode' => '24']);
        $this->getJson('/api/payments/vnpay/order/ipn?' . http_build_query($du))
            ->assertJsonPath('RspCode', '00');

        $don = Order::find($id);
        $this->assertSame('active', $don->status, 'Đơn phải còn để thu cách khác.');
        $this->assertSame('failed', $don->payment_status);

        // Và thu tiền mặt vẫn phải chạy được ngay sau đó.
        $this->postJson("/api/shops/{$this->shop->id}/orders/{$id}/pay", [
            'payment_method' => 'cash', 'cash_received' => 100_000,
        ])->assertStatus(200)->assertJsonPath('status', 'paid');
    }

    /**
     * VNPay chỉ gọi MỘT địa chỉ IPN đã khai trong cổng thương nhân — đó là
     * `payments/vnpay/ipn` (vốn của luồng mua gói). Nên chính tuyến ĐÓ phải nhận ra
     * callback của đơn bán hàng và xử lý đúng.
     *
     * Đây là bài kiểm đắt giá nhất tệp này: thiếu nó, đơn thanh toán thật trên bản
     * deploy trả tiền xong vẫn nằm ở 'active/pending' — đúng chuyện đã xảy ra ngày
     * 24/08 khi chạy thử lần đầu trên Render.
     */
    public function test_IPN_chung_cua_VNPay_nhan_ra_va_chot_dung_don_ban_hang(): void
    {
        $id = $this->taoDon();
        $ref = $this->xinLienKet($id)->json('txn_ref');
        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref]);

        // Gọi vào tuyến CỦA LUỒNG MUA GÓI — đúng như VNPay thật sẽ làm.
        $this->getJson('/api/payments/vnpay/ipn?' . http_build_query($du))
            ->assertStatus(200)->assertJsonPath('RspCode', '00');

        $don = Order::find($id);
        $this->assertSame('paid', $don->status, 'Đơn phải được chốt qua tuyến IPN chung.');
        $this->assertNotEmpty($don->invoice_code);
    }

    /** Và callback của MUA GÓI đi vào đúng nhánh cũ, không bị nhánh đơn hàng nuốt mất. */
    public function test_IPN_chung_van_xu_ly_dung_callback_mua_goi(): void
    {
        $du = $this->callbackVnpay(['vnp_TxnRef' => 'TXN-20260824-0001']);

        // Không có package_payment nào khớp -> nhánh mua gói trả '01', KHÔNG phải '00'.
        // Nếu nhánh đơn hàng nuốt mất thì mã trả về sẽ khác.
        $this->getJson('/api/payments/vnpay/ipn?' . http_build_query($du))
            ->assertStatus(200)->assertJsonPath('RspCode', '01');
    }

    // --- Trang khách quay về ----------------------------------------------------

    /**
     * Trang quay về CŨNG chốt đơn — và đó là đường duy nhất chắc chắn chạy.
     *
     * IPN chỉ tới nếu địa chỉ của nó được khai trong cổng thương nhân VNPay. Thử thật
     * trên bản deploy 24/08: khách trả tiền sandbox xong, thấy trang cảm ơn, mà IPN
     * không bao giờ tới. Dựa vào một mình IPN là dựa vào thứ mình không kiểm soát.
     *
     * An toàn vì chữ ký: ai cũng GỌI được đường này, nhưng không ai dựng nổi
     * `vnp_SecureHash` hợp lệ nếu không có khóa bí mật.
     */
    public function test_trang_quay_ve_cung_chot_don(): void
    {
        $id = $this->taoDon();
        $ref = $this->xinLienKet($id)->json('txn_ref');
        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref]);

        $this->get('/api/payments/vnpay/order/return?' . http_build_query($du))
            ->assertStatus(200)
            ->assertSee('Thanh toán thành công');

        $don = Order::find($id);
        $this->assertSame('paid', $don->status);
        $this->assertNotEmpty($don->invoice_code);
    }

    /** Chữ ký sai thì trang quay về KHÔNG chốt gì cả — đó là chốt chặn thật sự. */
    public function test_trang_quay_ve_sai_chu_ky_khong_chot_don(): void
    {
        $id = $this->taoDon();
        $ref = $this->xinLienKet($id)->json('txn_ref');
        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref]);
        $du['vnp_SecureHash'] = str_repeat('0', 128);

        $this->get('/api/payments/vnpay/order/return?' . http_build_query($du))
            ->assertStatus(200)
            ->assertSee('Thanh toán chưa hoàn tất');

        $this->assertSame('active', Order::find($id)->status);
    }

    /** Return tới trước rồi IPN tới sau: chỉ MỘT mã phiếu, không chốt hai lần. */
    public function test_return_roi_IPN_van_chi_mot_ma_phieu(): void
    {
        $id = $this->taoDon();
        $ref = $this->xinLienKet($id)->json('txn_ref');
        $du = $this->callbackVnpay(['vnp_TxnRef' => $ref]);

        $this->get('/api/payments/vnpay/order/return?' . http_build_query($du));
        $maLan1 = Order::find($id)->invoice_code;

        $this->getJson('/api/payments/vnpay/ipn?' . http_build_query($du))
            ->assertJsonPath('RspCode', '00');

        $this->assertSame($maLan1, Order::find($id)->invoice_code);
        $this->assertSame(1, $this->shop->orders()->where('status', 'paid')->count());
    }
}
