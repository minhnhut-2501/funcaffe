<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

/**
 * Nạp lại TOÀN BỘ dữ liệu mẫu: XÓA SẠCH rồi tạo mới.
 *
 * CHẠY TAY, KHÔNG BAO GIỜ tự động — ProductionSeeder (chạy mỗi lần container khởi
 * động) tuyệt đối không được gọi seeder này, vì nó xóa dữ liệu.
 *
 *     php artisan db:seed --class=DemoSeeder --force
 *
 * KIỂU DỮ LIỆU: mọi khóa ngoại ghi bằng CHUỖI, _id là ObjectId, ngày là UTCDateTime
 * — đúng như những gì chính ứng dụng ghi ra (đã đối chiếu với document do app tạo).
 * Ghi ObjectId vào khóa ngoại là quan hệ đứt ngầm: truy vấn trả về rỗng, không báo lỗi.
 */
class DemoSeeder extends Seeder
{
    private const PASSWORD = '12345678';
    private const VAT = 10;

    // _id cố định, phải khớp TestUserSeeder (nó chạy lại mỗi lần Render khởi động).
    private const ADMIN_ID = '6a3910511846951d38041ca8';
    private const OWNER_ID = '6a3910511846951d38041ca7';

    // _id gói giữ nguyên theo CSDL đang dùng ở máy để mọi tham chiếu cũ còn khớp.
    private const PKG_FREE = '6a3e50c13a064fb807035542';
    private const PKG_PRO = '6a3e50c13a064fb807035543';
    private const PKG_PROMAX = '6a3e50c13a064fb807035544';

    /** Các collection bị xóa sạch. Không đụng migrations/sessions/cache/jobs. */
    private const WIPE = [
        'users', 'cafes', 'categories', 'items', 'item_prices', 'toppings', 'item_toppings',
        'tables', 'orders', 'order_details', 'order_detail_toppings', 'subscriptions',
        'package_payments', 'reviews', 'contact_messages', 'packages', 'time_subscriptions',
        'personal_access_tokens',
    ];

    /** Collection của thiết kế cũ — hóa đơn nay là VIEW của order đã thanh toán. Xóa hẳn. */
    private const DROP = ['invoices'];

    private $db;
    private Carbon $now;

    public function run(): void
    {
        $this->db = DB::connection('mongodb')->getDatabase();
        $this->now = Carbon::now();

        // Cùng một hạt giống -> chạy lại ra đúng bộ số cũ, tiện đối chiếu khi kiểm.
        mt_srand(20260805);

        $this->wipe();
        $this->seedPackages();

        $ownerId = $this->seedAccounts();
        $this->seedOwnerCafes($ownerId);
        $this->seedFakeUsers();
        $this->seedContactMessages();

        $this->createIndexes();
        $this->summary();
    }

    // ---------------------------------------------------------------- tiện ích

    private function ts(Carbon $t): UTCDateTime
    {
        return new UTCDateTime($t->getTimestampMs());
    }

    /** Thêm created_at/updated_at rồi insertMany. Trả về số document đã ghi. */
    private function insert(string $collection, array $docs, ?Carbon $at = null): int
    {
        if (!$docs) {
            return 0;
        }

        $stamp = $this->ts($at ?? $this->now);
        foreach ($docs as &$d) {
            $d['created_at'] = $d['created_at'] ?? $stamp;
            $d['updated_at'] = $d['updated_at'] ?? $d['created_at'];
        }
        unset($d);

        $this->db->selectCollection($collection)->insertMany($docs);

        return count($docs);
    }

    private function pick(array $arr)
    {
        return $arr[mt_rand(0, count($arr) - 1)];
    }

    private function wipe(): void
    {
        foreach (self::WIPE as $c) {
            $n = $this->db->selectCollection($c)->countDocuments();
            if ($n > 0) {
                $this->db->selectCollection($c)->deleteMany([]);
                $this->command->warn("  đã xóa {$c}: {$n} document");
            }
        }

        foreach (self::DROP as $c) {
            if ($this->db->selectCollection($c)->countDocuments() >= 0
                && iterator_count($this->db->listCollections(['filter' => ['name' => $c]])) > 0) {
                $this->db->selectCollection($c)->drop();
                $this->command->warn("  đã bỏ hẳn collection {$c} (thiết kế cũ)");
            }
        }
    }

    // ---------------------------------------------------------------- gói + giá

    private function seedPackages(): void
    {
        // features lưu dạng chuỗi JSON — đúng như model Package (cast 'array') ghi xuống.
        $pkg = fn (string $id, array $a) => array_merge([
            '_id' => new ObjectId($id),
            'status' => 'active',
        ], $a, ['features' => json_encode($a['features'], JSON_UNESCAPED_UNICODE)]);

        $this->insert('packages', [
            $pkg(self::PKG_FREE, [
                'name' => 'Fun Free', 'type' => 'free', 'level' => 0, 'is_trial' => true,
                'description' => 'Dùng thử toàn bộ tính năng Pro Max trong 7 ngày (1 lần/quán)',
                'features' => [
                    'Trải nghiệm TOÀN BỘ tính năng Pro Max trong 7 ngày',
                    'Không giới hạn bàn & thực đơn',
                    'Trợ lý AI & phân tích doanh thu tự động',
                    'Quản lý size & topping',
                    'Bán hàng theo bàn, order & hóa đơn',
                    'Thống kê & biểu đồ doanh thu',
                    'Chỉ dùng thử 1 lần / quán',
                ],
                // null = không giới hạn (khớp EnforcesPackageLimits + lib/permission.ts)
                'max_tables' => null, 'max_menu_items' => null, 'can_use_ai' => true,
            ]),
            $pkg(self::PKG_PRO, [
                'name' => 'Pro', 'type' => 'pro', 'level' => 1, 'is_trial' => false,
                'description' => 'Đầy đủ chức năng + doanh thu (tối đa 20 bàn, 40 món)',
                'features' => [
                    'Quản lý thông tin quán',
                    'Tối đa 20 bàn',
                    'Thực đơn tối đa 40 món',
                    'Quản lý size & topping',
                    'Bán hàng theo bàn',
                    'Quản lý order & hóa đơn',
                    'In hóa đơn',
                    'Thống kê & biểu đồ doanh thu',
                ],
                'max_tables' => 20, 'max_menu_items' => 40, 'can_use_ai' => false,
            ]),
            $pkg(self::PKG_PROMAX, [
                'name' => 'Pro Max', 'type' => 'promax', 'level' => 2, 'is_trial' => false,
                'description' => 'Không giới hạn + trợ lý AI',
                'features' => [
                    'Toàn bộ chức năng gói Pro',
                    'Không giới hạn bàn & thực đơn',
                    'Thống kê doanh thu chi tiết',
                    'Top món bán chạy & báo cáo',
                    'Trợ lý AI & phân tích doanh thu tự động',
                ],
                'max_tables' => null, 'max_menu_items' => null, 'can_use_ai' => true,
            ]),
        ]);

        $t = fn (string $id, string $pkgId, int $v, string $unit, int $price, string $label) => [
            '_id' => new ObjectId($id), 'package_id' => $pkgId,
            'duration_value' => $v, 'duration_unit' => $unit,
            'price' => $price, 'label' => $label, 'status' => 'active',
        ];

        $this->insert('time_subscriptions', [
            $t('6a3e50c13a064fb807035545', self::PKG_FREE, 7, 'day', 0, '7 ngày'),
            $t('6a3e50c13a064fb807035546', self::PKG_PRO, 1, 'month', 199000, '1 tháng'),
            $t('6a3e50c13a064fb807035547', self::PKG_PRO, 3, 'month', 549000, '3 tháng'),
            $t('6a3e50c13a064fb807035548', self::PKG_PRO, 12, 'month', 1990000, '12 tháng'),
            $t('6a3e50c13a064fb807035549', self::PKG_PROMAX, 1, 'month', 499000, '1 tháng'),
            $t('6a3e50c13a064fb80703554a', self::PKG_PROMAX, 3, 'month', 1399000, '3 tháng'),
            $t('6a3e50c13a064fb80703554b', self::PKG_PROMAX, 12, 'month', 4990000, '12 tháng'),
        ]);
    }

    // ---------------------------------------------------------------- tài khoản

    private function seedAccounts(): string
    {
        $this->insert('users', [[
            '_id' => new ObjectId(self::ADMIN_ID),
            'full_name' => 'Admin FunCafe', 'email' => 'adminfuncafe@gmail.com',
            'password' => Hash::make(self::PASSWORD), 'phone' => '0900000000',
            'avatar' => null, 'role' => 'admin', 'status' => 'active',
            'created_at' => $this->ts($this->now->copy()->subMonths(8)),
        ]]);

        $this->insert('users', [[
            '_id' => new ObjectId(self::OWNER_ID),
            'full_name' => 'Nguyễn Minh Nhựt', 'email' => 'nphec4007@gmail.com',
            'password' => Hash::make(self::PASSWORD), 'phone' => '0901234567',
            'avatar' => null, 'role' => 'user', 'status' => 'active',
            // Các quán của chủ này đều đã dùng hết lượt dùng thử (xem makeCafe), nên cờ
            // cấp tài khoản phải khớp — dùng thử bị chặn ở cả hai cấp.
            'has_used_free_trial' => true,
            'created_at' => $this->ts($this->now->copy()->subMonths(7)),
        ]]);

        return self::OWNER_ID;
    }

    // ------------------------------------------------------- 3 quán của chủ quán

    private function seedOwnerCafes(string $ownerId): void
    {
        // Mốc bắt đầu bán hàng của hai quán trả phí: ngày đầu của tháng cách đây 2 tháng.
        // Chạy vào 8/2026 thì ra 01/06/2026 — đúng khoảng "từ tháng 6 đến giờ".
        $tuThang6 = $this->now->copy()->startOfMonth()->subMonths(2);

        // Quán 1 — Fun Free, CÒN 5 NGÀY: để giao diện hiện cảnh báo sắp hết hạn.
        $c1 = $this->makeCafe($ownerId, 'Cà Phê Phin 76', '76 Trần Hưng Đạo, Q.5, TP.HCM', '0912345601',
            'Quán phin truyền thống trong hẻm, bán mang đi là chính.', '970436', '0071000123456',
            'NGUYEN MINH NHUT', '/quan/phin-76.jpg');
        $this->menuPhin76($c1);
        $this->makeTables($c1, 6);

        // Gói Pro 3 tháng ĐÃ HẾT HẠN, nối liền ngay trước gói dùng thử hiện tại: 45 ngày
        // đơn hàng phía dưới đều nằm trong thời gian có gói hợp lệ, không có đoạn nào
        // "bán hàng khi chưa mua gói". /cafes lấy gói có end_date LỚN NHẤT nên thẻ quán
        // vẫn hiện Fun Free, còn đây là lịch sử.
        $old1 = $this->makeSubscription($c1, self::PKG_PRO, 'Pro', '6a3e50c13a064fb807035547',
            $this->now->copy()->subDays(92), $this->now->copy()->subDays(2), 549000);
        $this->makePayment($ownerId, $c1, self::PKG_PRO, '6a3e50c13a064fb807035547', $old1,
            549000, 'vnpay', $this->now->copy()->subDays(92));

        $this->makeSubscription($c1, self::PKG_FREE, 'Fun Free', '6a3e50c13a064fb807035545',
            $this->now->copy()->subDays(2), $this->now->copy()->addDays(5), 0);
        $this->makeOrders($c1, $this->now->copy()->subDays(45), 2, 5);

        // Quán 2 — Pro: dữ liệu vừa đủ để bộ đếm hạn mức (n/20 bàn, n/40 món) nhìn thấy được.
        // Gói mua trước mốc bán hàng vài ngày, nên mọi hoá đơn đều nằm trong hạn gói.
        $c2 = $this->makeCafe($ownerId, 'Cà Phê Bên Hiên', '215 Nguyễn Văn Cừ, Q.1, TP.HCM', '0912345602',
            'Quán hai tầng, có sân trước, khách ngồi lâu và làm việc.', '970407', '19036789012345',
            'NGUYEN MINH NHUT', '/quan/ben-hien.jpg');
        $this->menuBenHien($c2);
        $this->makeTables($c2, 14);
        $muaGoi2 = $tuThang6->copy()->subDays(5);
        $sub2 = $this->makeSubscription($c2, self::PKG_PRO, 'Pro', '6a3e50c13a064fb807035548',
            $muaGoi2, $muaGoi2->copy()->addMonths(12), 1990000);
        $this->makePayment($ownerId, $c2, self::PKG_PRO, '6a3e50c13a064fb807035548', $sub2,
            1990000, 'vnpay', $muaGoi2);
        $this->makeOrders($c2, $tuThang6, 4, 8);

        // Quán 3 — Pro Max: quán lớn nhất, doanh thu cao nhất, có AI. Hai bản ghi gói nối
        // đuôi nhau (mua mới rồi gia hạn) để màn hình Gói dịch vụ có lịch sử thật.
        $c3 = $this->makeCafe($ownerId, 'Nắng Sài Gòn Coffee', '12 Lê Lợi, Q.1, TP.HCM', '0912345603',
            'Quán lớn ngay trung tâm, phục vụ cả cà phê máy, trà và bánh.', '970422', '0031000998877',
            'NGUYEN MINH NHUT', '/quan/nang-sai-gon.jpg');
        $this->menuNangSaiGon($c3);
        $this->makeTables($c3, 18);

        $muaGoi3 = $tuThang6->copy()->subDays(10);
        $sub3a = $this->makeSubscription($c3, self::PKG_PROMAX, 'Pro Max', '6a3e50c13a064fb807035549',
            $muaGoi3, $muaGoi3->copy()->addMonth(), 499000);
        $this->makePayment($ownerId, $c3, self::PKG_PROMAX, '6a3e50c13a064fb807035549', $sub3a,
            499000, 'momo', $muaGoi3);

        $giaHan3 = $muaGoi3->copy()->addMonth();
        $sub3b = $this->makeSubscription($c3, self::PKG_PROMAX, 'Pro Max', '6a3e50c13a064fb80703554b',
            $giaHan3, $giaHan3->copy()->addMonths(12), 4990000, 'renew');
        $this->makePayment($ownerId, $c3, self::PKG_PROMAX, '6a3e50c13a064fb80703554b', $sub3b,
            4990000, 'vnpay', $giaHan3, 'renew');

        $this->makeOrders($c3, $tuThang6, 6, 11);
    }

    private function makeCafe(string $userId, string $name, string $addr, string $phone,
                              string $desc, string $bin, string $acc, string $accName,
                              ?string $logo = null): string
    {
        $id = (string) new ObjectId();
        $this->insert('cafes', [[
            '_id' => new ObjectId($id), 'user_id' => $userId, 'name' => $name,
            'address' => $addr, 'phone' => $phone, 'description' => $desc,
            'logo' => $logo, 'status' => 'open',
            'bank_bin' => $bin, 'bank_account_number' => $acc, 'bank_account_name' => $accName,
            'has_used_free_trial' => true,
            'created_at' => $this->ts($this->now->copy()->subDays(120)),
        ]]);

        return $id;
    }

    private function makeTables(string $cafeId, int $n): void
    {
        $docs = [];
        for ($i = 1; $i <= $n; $i++) {
            $docs[] = [
                '_id' => new ObjectId(), 'cafe_id' => $cafeId, 'name' => "Bàn {$i}",
                'capacity' => $i <= 2 ? 2 : ($i % 4 === 0 ? 6 : 4),
                'display_order' => $i, 'status' => 'empty', 'current_order_id' => null,
                'created_at' => $this->ts($this->now->copy()->subDays(120)),
            ];
        }
        $this->insert('tables', $docs);
    }

    /**
     * Nạp thực đơn từ mô tả gọn: mỗi danh mục là
     * [tên => [ [tên món, giá, sizes, cho topping, tên tệp ảnh], ... ] ].
     * $sizes rỗng = món một giá (base_price); có sizes = base_price 0 + các dòng item_prices.
     *
     * Ảnh ghi thẳng vào đây dưới dạng đường dẫn tương đối `/mon/<tên>.jpg` — tệp nằm
     * trong `public/` của frontend (xem public/mon/NGUON-ANH.md). Trước đây phải chạy
     * riêng scripts/gan-anh-thuc-don.mjs để gán ảnh sau khi seed; nay không cần nữa.
     */
    private function makeMenu(string $cafeId, array $tree, array $toppings = []): void
    {
        $created = $this->ts($this->now->copy()->subDays(118));

        $toppingIds = [];
        if ($toppings) {
            $docs = [];
            foreach ($toppings as [$name, $price, $img]) {
                $tid = (string) new ObjectId();
                $toppingIds[] = $tid;
                $docs[] = [
                    '_id' => new ObjectId($tid), 'cafe_id' => $cafeId, 'name' => $name,
                    'price' => $price, 'image' => "/mon/{$img}.jpg", 'is_available' => true,
                    'created_at' => $created,
                ];
            }
            $this->insert('toppings', $docs);
        }

        $cats = $items = $prices = $links = [];
        $order = 0;

        foreach ($tree as $catName => $rows) {
            $catId = (string) new ObjectId();
            $cats[] = [
                '_id' => new ObjectId($catId), 'cafe_id' => $cafeId, 'name' => $catName,
                'description' => null, 'is_active' => true, 'created_at' => $created,
            ];

            foreach ($rows as [$name, $price, $sizes, $allowTopping, $img]) {
                $itemId = (string) new ObjectId();
                $items[] = [
                    '_id' => new ObjectId($itemId), 'cafe_id' => $cafeId, 'category_id' => $catId,
                    'name' => $name, 'description' => null, 'image' => "/mon/{$img}.jpg",
                    'base_price' => $sizes ? 0 : $price,
                    'has_size' => (bool) $sizes,
                    'allow_topping' => $allowTopping && $toppingIds !== [],
                    'is_available' => true, 'display_order' => ++$order,
                    'created_at' => $created,
                ];

                foreach ($sizes as $sizeName => $sizePrice) {
                    $prices[] = [
                        '_id' => new ObjectId(), 'item_id' => $itemId, 'size_name' => $sizeName,
                        'price' => $sizePrice, 'is_active' => true, 'created_at' => $created,
                    ];
                }

                if ($allowTopping) {
                    foreach ($toppingIds as $tid) {
                        $links[] = [
                            '_id' => new ObjectId(), 'item_id' => $itemId, 'topping_id' => $tid,
                            'created_at' => $created,
                        ];
                    }
                }
            }
        }

        $this->insert('categories', $cats);
        $this->insert('items', $items);
        $this->insert('item_prices', $prices);
        $this->insert('item_toppings', $links);
    }

    /**
     * THỰC ĐƠN: tên món, giá và size lấy theo bảng giá Highlands Coffee (8/2026) để dữ
     * liệu mẫu giống một quán cà phê Việt Nam có thật. Ảnh cùng nguồn — xem
     * public/mon/NGUON-ANH.md, trong đó ghi rõ giấy phép và cách đã bỏ nhãn hiệu.
     */
    private function menuPhin76(string $cafeId): void
    {
        // Quán phin truyền thống: một giá, không size, không topping.
        $this->makeMenu($cafeId, [
            'Cà phê phin' => [
                ['Phin Sữa Đá', 29000, [], false, 'phin-sua-da'],
                ['Phin Đen Đá', 29000, [], false, 'phin-den-da'],
                ['Bạc Xỉu Đá', 39000, [], false, 'bac-xiu-da'],
                ['Phin Sữa Nóng', 29000, [], false, 'phin-sua-nong'],
                ['Phin Đen Nóng', 29000, [], false, 'phin-den-nong'],
            ],
            'Trà' => [
                ['Trà Sen Vàng', 45000, [], false, 'tra-sen-vang'],
                ['Trà Thanh Đào', 45000, [], false, 'tra-thanh-dao'],
            ],
            'Bánh' => [
                ['Bánh Mì Que Pate', 19000, [], false, 'banh-mi-que-pate'],
                ['Bánh Croissant', 29000, [], false, 'croissant'],
                ['Bánh Chuối', 29000, [], false, 'banh-chuoi'],
            ],
        ]);
    }

    private function menuBenHien(string $cafeId): void
    {
        // 30 món và 14 bàn — dưới trần gói Pro (40 món / 20 bàn), đủ để bộ đếm hạn mức
        // trên màn hình Thực đơn và Bàn hiện ra con số có ý nghĩa.
        $s = fn (int $a, int $b, int $c) => ['S' => $a, 'M' => $b, 'L' => $c];

        $this->makeMenu($cafeId, [
            'Cà phê phin' => [
                ['Phin Sữa Đá', 0, $s(29000, 39000, 45000), false, 'phin-sua-da'],
                ['Phin Đen Đá', 0, $s(29000, 35000, 39000), false, 'phin-den-da'],
                ['Bạc Xỉu Đá', 0, $s(29000, 39000, 45000), false, 'bac-xiu-da'],
                ['Phin Sữa Nóng', 0, $s(29000, 39000, 45000), false, 'phin-sua-nong'],
                ['Phin Đen Nóng', 0, $s(29000, 35000, 39000), false, 'phin-den-nong'],
            ],
            'Cà phê máy' => [
                ['Americano Đá', 0, $s(45000, 49000, 55000), false, 'americano-da'],
                ['Americano Nóng', 0, $s(45000, 49000, 55000), false, 'americano-nong'],
                ['Latte Đá', 0, $s(55000, 59000, 65000), false, 'latte-da'],
                ['Latte Nóng', 0, $s(55000, 59000, 65000), false, 'latte-nong'],
                ['Cappuccino Đá', 0, $s(55000, 59000, 65000), false, 'cappuccino-da'],
            ],
            'PhinDi' => [
                ['PhinDi Kem Sữa', 0, $s(45000, 49000, 55000), true, 'phindi-kem-sua'],
                ['PhinDi Choco', 0, $s(45000, 49000, 55000), true, 'phindi-choco'],
                ['PhinDi Hạnh Nhân', 0, $s(45000, 49000, 55000), true, 'phindi-hanh-nhan'],
            ],
            'Trà' => [
                ['Trà Sen Vàng', 0, $s(45000, 55000, 65000), true, 'tra-sen-vang'],
                ['Trà Thanh Đào', 0, $s(45000, 55000, 65000), true, 'tra-thanh-dao'],
                ['Trà Thạch Đào', 0, $s(45000, 55000, 65000), true, 'tra-thach-dao'],
                ['Trà Thạch Vải', 0, $s(45000, 55000, 65000), true, 'tra-thach-vai'],
                ['Trà Xanh Đậu Đỏ', 0, $s(45000, 55000, 65000), true, 'tra-xanh-dau-do'],
            ],
            'Freeze' => [
                ['Freeze Trà Xanh', 0, $s(55000, 65000, 69000), true, 'freeze-tra-xanh'],
                ['Freeze Sô-Cô-La', 0, $s(55000, 65000, 69000), true, 'freeze-so-co-la'],
                ['Cookies & Cream', 0, $s(55000, 65000, 69000), true, 'cookies-and-cream'],
            ],
            'Thức uống khác' => [
                ['Sô Cô La Đá', 59000, [], true, 'so-co-la-da'],
                ['Chanh Đá Viên', 49000, [], false, 'chanh-da-vien'],
                ['Chanh Dây Đá Viên', 49000, [], false, 'chanh-day-da-vien'],
            ],
            'Bánh' => [
                ['Bánh Mì Que Pate', 19000, [], false, 'banh-mi-que-pate'],
                ['Bánh Mì Que Gà Phô Mai', 19000, [], false, 'banh-mi-que-ga-pho-mai'],
                ['Bánh Croissant', 29000, [], false, 'croissant'],
                ['Bánh Su Kem', 29000, [], false, 'banh-su-kem'],
                ['Bánh Tiramisu', 39000, [], false, 'banh-tiramisu'],
                ['Bánh Phô Mai Trà Xanh', 35000, [], false, 'banh-pho-mai-tra-xanh'],
            ],
        ], [
            ['Trân châu đen', 10000, 'tran-chau'],
            ['Thạch dừa', 10000, 'thach-dua'],
            ['Pudding trứng', 10000, 'pudding'],
            ['Kem phô mai', 15000, 'kem-tuoi'],
        ]);
    }

    private function menuNangSaiGon(string $cafeId): void
    {
        // Quán lớn nhất, gói Pro Max nên không vướng trần nào: 43 món, 18 bàn.
        $s = fn (int $a, int $b, int $c) => ['S' => $a, 'M' => $b, 'L' => $c];
        $ml = fn (int $a, int $b) => ['M' => $a, 'L' => $b];

        $this->makeMenu($cafeId, [
            'Cà phê phin' => [
                ['Phin Sữa Đá', 0, $s(29000, 39000, 45000), false, 'phin-sua-da'],
                ['Phin Đen Đá', 0, $s(29000, 35000, 39000), false, 'phin-den-da'],
                ['Bạc Xỉu Đá', 0, $s(29000, 39000, 45000), false, 'bac-xiu-da'],
                ['Phin Sữa Nóng', 0, $s(29000, 39000, 45000), false, 'phin-sua-nong'],
                ['Phin Đen Nóng', 0, $s(29000, 35000, 39000), false, 'phin-den-nong'],
            ],
            'Cà phê máy' => [
                ['Americano Đá', 0, $s(45000, 49000, 55000), false, 'americano-da'],
                ['Americano Nóng', 0, $s(45000, 49000, 55000), false, 'americano-nong'],
                ['Americano Đào', 0, $ml(55000, 59000), false, 'americano-dao'],
                ['Americano Nước Dừa', 0, $ml(55000, 59000), false, 'americano-nuoc-dua'],
                ['Latte Đá', 0, $s(55000, 59000, 65000), false, 'latte-da'],
                ['Latte Nóng', 0, $s(55000, 59000, 65000), false, 'latte-nong'],
                ['Cappuccino Đá', 0, $s(55000, 59000, 65000), false, 'cappuccino-da'],
                ['Cappuccino Nóng', 0, $s(55000, 59000, 65000), false, 'cappuccino-nong'],
            ],
            'PhinDi' => [
                ['PhinDi Kem Sữa', 0, $s(45000, 49000, 55000), true, 'phindi-kem-sua'],
                ['PhinDi Choco', 0, $s(45000, 49000, 55000), true, 'phindi-choco'],
                ['PhinDi Hạnh Nhân', 0, $s(45000, 49000, 55000), true, 'phindi-hanh-nhan'],
            ],
            'Trà' => [
                ['Trà Sen Vàng', 0, $s(45000, 55000, 65000), true, 'tra-sen-vang'],
                ['Trà Thanh Đào', 0, $s(45000, 55000, 65000), true, 'tra-thanh-dao'],
                ['Trà Thanh Đào Nóng', 0, $s(45000, 55000, 65000), false, 'tra-thanh-dao-nong'],
                ['Trà Thạch Đào', 0, $s(45000, 55000, 65000), true, 'tra-thach-dao'],
                ['Trà Thạch Vải', 0, $s(45000, 55000, 65000), true, 'tra-thach-vai'],
                ['Trà Xanh Đậu Đỏ', 0, $s(45000, 55000, 65000), true, 'tra-xanh-dau-do'],
            ],
            'Freeze' => [
                ['Freeze Trà Xanh', 0, $s(55000, 65000, 69000), true, 'freeze-tra-xanh'],
                ['Freeze Sô-Cô-La', 0, $s(55000, 65000, 69000), true, 'freeze-so-co-la'],
                ['Cookies & Cream', 0, $s(55000, 65000, 69000), true, 'cookies-and-cream'],
            ],
            'Thức uống khác' => [
                ['Sô Cô La Đá', 59000, [], true, 'so-co-la-da'],
                ['Sô Cô La Nóng', 59000, [], true, 'so-co-la-nong'],
                ['Sữa Tươi Nóng', 49000, [], true, 'sua-tuoi-nong'],
                ['Chanh Đá Xay', 0, $s(39000, 49000, 55000), false, 'chanh-da-xay'],
                ['Chanh Đá Viên', 49000, [], false, 'chanh-da-vien'],
                ['Chanh Dây Đá Viên', 49000, [], false, 'chanh-day-da-vien'],
                ['Tắc Đá Viên', 49000, [], false, 'tac-da-vien'],
            ],
            'Bánh' => [
                ['Bánh Mì Que Pate', 19000, [], false, 'banh-mi-que-pate'],
                ['Bánh Mì Que Gà Phô Mai', 19000, [], false, 'banh-mi-que-ga-pho-mai'],
                ['Bánh Croissant', 29000, [], false, 'croissant'],
                ['Bánh Su Kem', 29000, [], false, 'banh-su-kem'],
                ['Bánh Chuối', 29000, [], false, 'banh-chuoi'],
                ['Bánh Bông Lan Castella', 30000, [], false, 'banh-bong-lan-castella'],
                ['Bánh Tiramisu', 39000, [], false, 'banh-tiramisu'],
                ['Bánh Sữa Chua Phô Mai', 39000, [], false, 'banh-sua-chua-pho-mai'],
                ['Bánh Phô Mai Trà Xanh', 35000, [], false, 'banh-pho-mai-tra-xanh'],
                ['Bánh Phô Mai Chanh Dây', 35000, [], false, 'banh-pho-mai-chanh-day'],
                ['Bánh Phô Mai Caramel', 35000, [], false, 'banh-pho-mai-caramel'],
            ],
        ], [
            ['Trân châu đen', 10000, 'tran-chau'],
            ['Thạch dừa', 10000, 'thach-dua'],
            ['Pudding trứng', 10000, 'pudding'],
            ['Kem phô mai', 15000, 'kem-tuoi'],
        ]);
    }

    // ------------------------------------------------------------------ gói/đơn

    private function makeSubscription(string $cafeId, string $pkgId, string $pkgName,
                                      string $timeSubId, Carbon $start, Carbon $end, int $subtotal,
                                      string $actionType = 'new'): string
    {
        $vat = (int) round($subtotal * self::VAT / 100);
        $id = (string) new ObjectId();

        $this->insert('subscriptions', [[
            '_id' => new ObjectId($id), 'cafe_id' => $cafeId, 'package_id' => $pkgId,
            'time_subscription_id' => $timeSubId, 'package_name_snapshot' => $pkgName,
            'start_date' => $this->ts($start), 'end_date' => $this->ts($end),
            'status' => 'active',
            'subtotal' => $subtotal, 'vat_rate' => self::VAT, 'vat_amount' => $vat,
            'total_amount' => $subtotal + $vat,
            'action_type' => $actionType,
            'created_at' => $this->ts($start),
        ]]);

        return $id;
    }

    private function makePayment(string $userId, string $cafeId, string $pkgId, string $timeSubId,
                                 string $subId, int $subtotal, string $method, Carbon $at,
                                 string $actionType = 'new'): void
    {
        $vat = (int) round($subtotal * self::VAT / 100);
        $seq = str_pad((string) mt_rand(1, 99), 4, '0', STR_PAD_LEFT);

        // Giờ ngẫu nhiên trong ngày. Mọi mốc thời gian ở đây đều dựng từ $this->now nên
        // nếu không đặt lại, cả chục giao dịch cách nhau hàng tháng lại cùng chung một
        // giờ phút — bảng "Giao dịch gần đây" của khu quản trị nhìn là biết dữ liệu bịa.
        $at = $at->copy()->setTime(mt_rand(8, 22), mt_rand(0, 59), mt_rand(0, 59));

        $this->insert('package_payments', [[
            '_id' => new ObjectId(), 'user_id' => $userId, 'cafe_id' => $cafeId,
            'package_id' => $pkgId, 'time_subscription_id' => $timeSubId, 'subscription_id' => $subId,
            'subtotal' => $subtotal, 'vat_rate' => self::VAT, 'vat_amount' => $vat,
            'amount' => $subtotal + $vat,
            'payment_method' => $method, 'payment_status' => 'paid',
            'transaction_code' => 'TXN-' . $at->format('Ymd') . '-' . $seq,
            'note' => null, 'paid_at' => $this->ts($at),
            'action_type' => $actionType, 'credit_amount' => 0,
            'gateway_txn_no' => in_array($method, ['vnpay', 'momo'], true) ? (string) mt_rand(10000000, 99999999) : null,
            'created_at' => $this->ts($at),
        ]]);
    }

    /**
     * Sinh đơn hàng ĐÃ THANH TOÁN rải theo ngày, từ $tu cho tới hôm nay.
     * Doanh thu chỉ tính order có status='paid' VÀ payment_status='paid' (xem
     * UserRevenueController), nên cả hai đều phải được đặt.
     */
    private function makeOrders(string $cafeId, Carbon $tu, int $min, int $max): void
    {
        $days = (int) $tu->copy()->startOfDay()->diffInDays($this->now->copy()->startOfDay());

        // preserve_keys = false: pick()/array_rand() cần mảng đánh số liên tục từ 0.
        $items = iterator_to_array($this->db->selectCollection('items')->find(['cafe_id' => $cafeId]), false);
        $tables = iterator_to_array($this->db->selectCollection('tables')->find(['cafe_id' => $cafeId]), false);
        $tops = iterator_to_array($this->db->selectCollection('toppings')->find(['cafe_id' => $cafeId]), false);

        // Giá theo size, gom sẵn theo item để khỏi truy vấn trong vòng lặp.
        $priceByItem = [];
        foreach ($this->db->selectCollection('item_prices')->find() as $p) {
            $priceByItem[(string) $p['item_id']][] = ['id' => (string) $p['_id'], 'name' => $p['size_name'], 'price' => (int) $p['price']];
        }

        $orders = $details = $detailTops = [];

        for ($d = $days; $d >= 0; $d--) {
            $day = $this->now->copy()->subDays($d);
            // Cuối tuần đông hơn — biểu đồ có nhịp thay vì phẳng lì.
            $isWeekend = in_array($day->dayOfWeek, [0, 6], true);
            $count = mt_rand($min, $max) + ($isWeekend ? (int) ceil($max * 0.4) : 0);
            if ($d === 0) {
                $count = max(1, (int) round($count * 0.6)); // hôm nay mới chạy nửa ngày
            }

            for ($n = 1; $n <= $count; $n++) {
                $at = $day->copy()->setTime(mt_rand(7, 21), mt_rand(0, 59), mt_rand(0, 59));
                $orderId = (string) new ObjectId();
                $table = $this->pick($tables);
                $seq = str_pad((string) $n, 4, '0', STR_PAD_LEFT);
                $orderTotal = 0;

                foreach (range(1, mt_rand(1, 4)) as $ignored) {
                    $item = $this->pick($items);
                    $itemId = (string) $item['_id'];
                    $qty = mt_rand(1, 3);

                    $sizes = $priceByItem[$itemId] ?? [];
                    if ($sizes) {
                        $size = $this->pick($sizes);
                        $unit = $size['price'];
                        $priceId = $size['id'];
                        $sizeName = $size['name'];
                    } else {
                        $unit = (int) $item['base_price'];
                        $priceId = null;
                        $sizeName = null;
                    }

                    $detailId = (string) new ObjectId();
                    $lineTop = 0;

                    if (($item['allow_topping'] ?? false) && $tops && mt_rand(0, 100) < 55) {
                        $chosen = (array) array_rand($tops, min(count($tops), mt_rand(1, 2)));
                        foreach ($chosen as $ti) {
                            $t = $tops[$ti];
                            $tPrice = (int) $t['price'];
                            $lineTop += $tPrice * $qty;
                            $detailTops[] = [
                                '_id' => new ObjectId(), 'order_detail_id' => $detailId,
                                'topping_id' => (string) $t['_id'],
                                'topping_name_snapshot' => $t['name'],
                                'quantity' => 1, 'price_at_time' => $tPrice,
                                'subtotal' => $tPrice * $qty,
                                'created_at' => $this->ts($at),
                            ];
                        }
                    }

                    $sub = $unit * $qty;
                    $details[] = [
                        '_id' => new ObjectId($detailId), 'order_id' => $orderId,
                        'item_id' => $itemId, 'item_name_snapshot' => $item['name'],
                        'item_price_id' => $priceId, 'size_name_snapshot' => $sizeName,
                        'quantity' => $qty, 'unit_price' => $unit,
                        'subtotal' => $sub, 'topping_total' => $lineTop,
                        'total_price' => $sub + $lineTop, 'note' => null,
                        'created_at' => $this->ts($at),
                    ];
                    $orderTotal += $sub + $lineTop;
                }

                $method = $this->pick(['cash', 'cash', 'vietqr', 'bank_transfer']);
                $paidAt = $at->copy()->addMinutes(mt_rand(15, 90));
                $doc = [
                    '_id' => new ObjectId($orderId), 'cafe_id' => $cafeId,
                    'table_id' => (string) $table['_id'],
                    'code' => 'ORD-' . $at->format('Ymd') . '-' . $seq,
                    'status' => 'paid', 'note' => null,
                    'subtotal' => $orderTotal, 'discount_amount' => 0, 'total_amount' => $orderTotal,
                    'invoice_code' => 'INV-' . $at->format('Ymd') . '-' . $seq,
                    'payment_method' => $method, 'payment_status' => 'paid',
                    'paid_at' => $this->ts($paidAt),
                    'created_at' => $this->ts($at),
                ];

                if ($method === 'cash') {
                    $given = (int) (ceil($orderTotal / 10000) * 10000) + (mt_rand(0, 1) ? 0 : 50000);
                    $doc['cash_received'] = $given;
                    $doc['change_amount'] = $given - $orderTotal;
                }

                $orders[] = $doc;
            }
        }

        // insertMany theo lô: một lượt đi/về mạng cho hàng trăm document thay vì
        // mỗi document một lượt — chạy qua Atlas mà insert lẻ thì mất hàng chục phút.
        foreach ([['orders', $orders], ['order_details', $details], ['order_detail_toppings', $detailTops]] as [$col, $rows]) {
            foreach (array_chunk($rows, 500) as $chunk) {
                $this->insert($col, $chunk);
            }
        }
    }

    // ------------------------------------------------------------- người dùng ảo

    private function seedFakeUsers(): void
    {
        // [tên, email, sđt, tên quán, địa chỉ, gói, id_thời_hạn, giá, số tháng trước, cổng]
        // Rải đều từ 7 tháng trước tới tháng này để biểu đồ doanh thu của khu quản trị
        // có đường đi liên tục, không phải mấy cột lẻ tẻ.
        $people = [
            ['Trần Thị Mỹ Duyên', 'duyen.tran@gmail.com', '0903111222', 'Cà Phê Sân Vườn Duyên', '15 Phan Xích Long, Phú Nhuận, TP.HCM', self::PKG_PROMAX, '6a3e50c13a064fb80703554b', 4990000, 7, 'vnpay'],
            ['Lê Hoàng Nam', 'namle.cafe@gmail.com', '0903111333', 'Nam Coffee Roastery', '88 Nguyễn Trãi, Q.5, TP.HCM', self::PKG_PRO, '6a3e50c13a064fb807035548', 1990000, 7, 'momo'],
            ['Phạm Quốc Huy', 'huypham2000@gmail.com', '0903111444', 'Huy Tea & Coffee', '204 Lý Thường Kiệt, Q.10, TP.HCM', self::PKG_PRO, '6a3e50c13a064fb807035547', 549000, 6, 'vnpay'],
            ['Nguyễn Thị Bích Ngọc', 'ngocnguyen.tea@gmail.com', '0903111555', 'Ngọc Milk Tea', '32 Hùng Vương, TP. Cần Thơ', self::PKG_PROMAX, '6a3e50c13a064fb80703554a', 1399000, 6, 'momo'],
            ['Võ Thành Đạt', 'datvo.brew@gmail.com', '0903111666', 'Đạt Brew Lab', '7 Bạch Đằng, TP. Đà Nẵng', self::PKG_PRO, '6a3e50c13a064fb807035546', 199000, 5, 'vnpay'],
            ['Đặng Thu Hà', 'hadang.coffee@gmail.com', '0903111777', 'Hà Coffee House', '120 Trần Phú, TP. Nha Trang', self::PKG_FREE, '6a3e50c13a064fb807035545', 0, 5, null],
            ['Bùi Minh Khoa', 'khoabui.cafe@gmail.com', '0903111888', 'Khoa Specialty', '55 Lê Duẩn, TP. Huế', self::PKG_PROMAX, '6a3e50c13a064fb807035549', 499000, 4, 'vnpay'],
            ['Hồ Thị Kim Anh', 'kimanh.ho@gmail.com', '0903111999', 'Kim Anh Trà Sữa', '9 Nguyễn Huệ, TP. Vũng Tàu', self::PKG_PRO, '6a3e50c13a064fb807035547', 549000, 4, 'momo'],
            ['Trương Gia Bảo', 'baotruong.dev@gmail.com', '0903112000', 'Bảo Cafe Sách', '77 Hai Bà Trưng, TP. Đà Lạt', self::PKG_FREE, '6a3e50c13a064fb807035545', 0, 3, null],
            ['Lý Thanh Tùng', 'tunglythanh@gmail.com', '0903112111', 'Tùng Coffee Station', '3 Quang Trung, TP. Biên Hòa', self::PKG_PRO, '6a3e50c13a064fb807035546', 199000, 3, 'momo'],
            ['Đỗ Ngọc Trâm', 'tramdo.cafe@gmail.com', '0903112222', 'Trâm Cà Phê Vườn', '18 Nguyễn Thị Minh Khai, TP. Buôn Ma Thuột', self::PKG_PROMAX, '6a3e50c13a064fb80703554a', 1399000, 2, 'vnpay'],
            ['Phan Văn Lộc', 'locphan.coffee@gmail.com', '0903112333', 'Lộc Phát Coffee', '221 Lê Văn Sỹ, Q.3, TP.HCM', self::PKG_PRO, '6a3e50c13a064fb807035548', 1990000, 2, 'momo'],
            ['Huỳnh Thị Mai', 'maihuynh.tea@gmail.com', '0903112444', 'Mai Trà Quán', '64 Hoàng Diệu, TP. Quy Nhơn', self::PKG_PRO, '6a3e50c13a064fb807035547', 549000, 1, 'vnpay'],
            ['Ngô Đức Thắng', 'thangngo.brew@gmail.com', '0903112555', 'Thắng Cà Phê Rang', '5 Trần Hưng Đạo, TP. Hải Phòng', self::PKG_PROMAX, '6a3e50c13a064fb807035549', 499000, 1, 'momo'],
            ['Vũ Hải Yến', 'yenvu.cafe@gmail.com', '0903112666', 'Yến Coffee & Bakery', '90 Cầu Giấy, Hà Nội', self::PKG_FREE, '6a3e50c13a064fb807035545', 0, 1, null],
        ];

        // Đánh giá: MỖI NGƯỜI TỐI ĐA MỘT (có unique index trên reviews.user_id).
        $reviewText = [
            0 => [5, 'Quản lý nhiều quán rất tiện', 'Mình có 2 chi nhánh, trước phải ghi sổ riêng từng nơi. Giờ đổi quán ngay trên thanh công cụ, doanh thu vẫn tách bạch.'],
            1 => [5, 'Đóng ca nhanh hơn hẳn', 'Cuối ngày chỉ cần mở mục doanh thu là ra đủ số, không phải cộng tay hóa đơn nữa.'],
            2 => [4, 'Dùng ổn, mong có thêm app điện thoại', 'Bán hàng theo bàn rõ ràng, nhân viên mới một buổi là quen. Nếu có ứng dụng riêng cho điện thoại thì tiện hơn.'],
            3 => [5, 'Size và topping đúng nhu cầu quán trà sữa', 'Mỗi món ba size, topping cấu hình riêng từng món nên order không bị nhầm.'],
            4 => [4, 'Gói 1 tháng hợp để dùng thử', 'Mình lấy gói tháng xem có hợp không rồi mới tính tiếp. Chuyển gói giữa chừng vẫn giữ nguyên dữ liệu cũ.'],
            6 => [5, 'Trợ lý AI phân tích doanh thu khá hữu ích', 'Hỏi tháng này bán chậm món nào là nó chỉ ra ngay, đỡ phải ngồi lọc bảng.'],
            7 => [4, 'Giao diện dễ nhìn, giá hợp lý', 'Gói Pro đủ cho quán nhỏ của mình. In hóa đơn nhanh, khách không phải chờ.'],
            9 => [3, 'Tốt nhưng lúc đông khách còn hơi chậm', 'Giờ cao điểm bấm thanh toán phải chờ vài giây. Còn lại thì không có gì để chê.'],
            10 => [5, 'Xuất Excel doanh thu rất được việc', 'Cuối tháng tải file về gửi cho kế toán, khỏi phải gõ lại từng dòng.'],
            11 => [5, 'Nhân viên mới học một buổi là chạy được', 'Màn hình bán hàng chia bàn rõ ràng, bấm nhầm còn sửa lại được trước khi thanh toán.'],
            12 => [4, 'Thống kê món bán chạy giúp mình cắt bớt menu', 'Nhìn bảng mới biết có mấy món cả tháng bán chưa tới chục ly, bỏ luôn cho gọn.'],
        ];

        $users = $cafes = $subs = $reviews = [];

        foreach ($people as $i => [$name, $email, $phone, $cafeName, $addr, $pkgId, $timeSubId, $price, $monthsAgo, $gateway]) {
            $uid = (string) new ObjectId();
            $cid = (string) new ObjectId();
            $joined = $this->now->copy()->subMonths($monthsAgo)->subDays(mt_rand(0, 25));

            $users[] = [
                '_id' => new ObjectId($uid), 'full_name' => $name, 'email' => $email,
                'password' => Hash::make(self::PASSWORD), 'phone' => $phone,
                'avatar' => null, 'role' => 'user', 'status' => 'active',
                // Đánh dấu ở CẢ cấp tài khoản, không chỉ cấp quán: dùng thử bị chặn ở hai
                // cấp (xem SubscriptionController::store). Thiếu cờ này thì tài khoản demo
                // vẫn xin thêm được một gói dùng thử nữa cho quán mới — dữ liệu mẫu sẽ mô tả
                // sai chính quy tắc mà hệ thống đang thực thi.
                'has_used_free_trial' => true,
                'created_at' => $this->ts($joined),
            ];

            $cafes[] = [
                '_id' => new ObjectId($cid), 'user_id' => $uid, 'name' => $cafeName,
                'address' => $addr, 'phone' => $phone,
                'description' => null, 'logo' => null, 'status' => 'open',
                'has_used_free_trial' => true,
                'created_at' => $this->ts($joined),
            ];

            // Gói mua ngay sau khi đăng ký, thời hạn ĐÚNG bằng thứ đã mua (suy từ giá) chứ
            // không kéo dài 12 tháng cho mọi người. Nhờ vậy ai mua gói tháng từ lâu thì gói
            // đó đã hết hạn — và ngay bên dưới sinh tiếp một lượt gia hạn, ra đúng cái hình
            // thường thấy: khách mua ngắn rồi gia hạn dài. Đó cũng là nguồn của các hoá đơn
            // mua gói rải đều trên biểu đồ doanh thu khu quản trị.
            $thangGoi = match ($price) {
                199000, 499000 => 1,
                549000, 1399000 => 3,
                1990000, 4990000 => 12,
                default => 0,
            };
            $tenGoi = $pkgId === self::PKG_PRO ? 'Pro' : ($pkgId === self::PKG_PROMAX ? 'Pro Max' : 'Fun Free');

            $start = $joined->copy()->addDays(mt_rand(0, 3));
            $end = $price > 0 ? $start->copy()->addMonths($thangGoi) : $start->copy()->addDays(7);
            $subId = (string) new ObjectId();
            $vat = (int) round($price * self::VAT / 100);

            $ghiSub = function (string $id, Carbon $tu, Carbon $den, string $loai) use (&$subs, $cid, $pkgId, $timeSubId, $tenGoi, $price, $vat) {
                $subs[] = [
                    '_id' => new ObjectId($id), 'cafe_id' => $cid, 'package_id' => $pkgId,
                    'time_subscription_id' => $timeSubId,
                    'package_name_snapshot' => $tenGoi,
                    'start_date' => $this->ts($tu), 'end_date' => $this->ts($den),
                    'status' => 'active',
                    'subtotal' => $price, 'vat_rate' => self::VAT, 'vat_amount' => $vat,
                    'total_amount' => $price + $vat,
                    'action_type' => $loai,
                    'created_at' => $this->ts($tu),
                ];
            };

            $ghiSub($subId, $start, $end, 'new');

            if ($price > 0) {
                $this->makePayment($uid, $cid, $pkgId, $timeSubId, $subId, $price, $gateway, $start);

                // Gói trả phí đã hết hạn trước hôm nay -> chủ quán gia hạn thêm 12 tháng.
                if ($end->lt($this->now)) {
                    $subId2 = (string) new ObjectId();
                    $ghiSub($subId2, $end, $end->copy()->addMonths(12), 'renew');
                    $this->makePayment($uid, $cid, $pkgId, $timeSubId, $subId2, $price, $gateway, $end, 'renew');
                }
            }

            if (isset($reviewText[$i])) {
                [$rating, $title, $comment] = $reviewText[$i];

                // Viết sau khi dùng một thời gian, nhưng KHÔNG được vượt quá hôm nay:
                // người mới đăng ký 1 tháng trước mà cộng thêm 40 ngày là ra ngày trong
                // tương lai, trang chủ sẽ hiện "đánh giá" đề ngày chưa tới.
                $vietLuc = $start->copy()->addDays(mt_rand(10, 40));
                if ($vietLuc->gt($this->now)) {
                    $vietLuc = $this->now->copy()->subDays(mt_rand(1, 6));
                }

                $reviews[] = [
                    '_id' => new ObjectId(), 'user_id' => $uid, 'cafe_id' => $cid,
                    'package_id' => $pkgId, 'rating' => $rating,
                    'title' => $title, 'comment' => $comment,
                    'status' => 'visible', 'history' => [],
                    'created_at' => $this->ts($vietLuc),
                ];
            }
        }

        $this->insert('users', $users);
        $this->insert('cafes', $cafes);
        $this->insert('subscriptions', $subs);
        $this->insert('reviews', $reviews);
    }

    // ----------------------------------------------------------- tin nhắn liên hệ

    /**
     * Tin gửi từ form Liên hệ ngoài trang công khai. Trước đây collection này bị
     * xoá sạch mà không nạp lại, nên màn hình Liên hệ của khu quản trị mở ra trống
     * trơn — không thấy được chuông tin chưa đọc lẫn luồng trả lời qua email.
     *
     * Trộn đủ ba trạng thái: chưa đọc (chuông sáng), đã đọc mà chưa trả lời, và đã
     * trả lời (có `reply` + `replied_at` + `replied_by` như Admin\ContactController ghi).
     */
    private function seedContactMessages(): void
    {
        // [tên, email, sđt, tên quán, ngày trước, nội dung, đã đọc, trả lời]
        $rows = [
            ['Nguyễn Văn Sơn', 'sonnguyen.cafe@gmail.com', '0905220011', 'Cà Phê Sơn Ca', 1,
             'Chào shop, quán mình có 2 chi nhánh thì cần mua 2 gói riêng hay 1 gói dùng chung được ạ?', false, null],
            ['Trần Bảo Trân', 'trantran.milktea@gmail.com', '0905220022', 'Trân Milk Tea', 2,
             'Mình đang dùng thử gói Fun Free, hết 7 ngày thì dữ liệu món và bàn còn giữ không hay mất hết?', false, null],
            ['Lê Quang Vinh', 'vinhlq.coffee@gmail.com', '0905220033', 'Vinh Coffee', 3,
             'Cho hỏi hệ thống có in được hoá đơn ra máy in nhiệt khổ 58mm không? Quán mình đang dùng máy Xprinter.', false, null],
            ['Phạm Thị Hồng', 'hongpham.tea@gmail.com', '0905220044', 'Hồng Trà Sữa', 5,
             'Mình muốn đổi từ gói Pro lên Pro Max giữa chừng thì tiền còn lại của gói cũ có được trừ vào không ạ?', true, null],
            ['Đinh Công Hậu', 'haudinh.brew@gmail.com', '0905220055', 'Hậu Brew', 7,
             'Bên mình cần xuất báo cáo doanh thu theo từng nhân viên. Hiện tại phần mềm có làm được chưa?', true, null],
            ['Vũ Thanh Thảo', 'thaovu.cafe@gmail.com', '0905220066', 'Thảo Garden Cafe', 9,
             'Web dùng trên máy tính bảng có được không? Quán mình định để một cái iPad ở quầy cho nhân viên bấm order.', true,
             'Chào bạn, hệ thống chạy trên trình duyệt nên iPad dùng bình thường, không cần cài gì thêm. Bạn mở Safari rồi đăng nhập là được. Màn hình bán hàng đã được bố trí lại cho khổ máy tính bảng nên bấm khá thoải mái.'],
            ['Hoàng Minh Tuấn', 'tuanhm.coffee@gmail.com', '0905220077', 'Tuấn Cà Phê Sạch', 12,
             'Mình quên mật khẩu, bấm quên mật khẩu mà không thấy thư về. Nhờ bên mình kiểm tra giúp với.', true,
             'Chào bạn, thư đặt lại mật khẩu đôi khi rơi vào mục Spam hoặc Quảng cáo của Gmail, bạn tìm thêm ở đó giúp mình. Nếu vẫn không thấy, bạn thử gửi lại sau 5 phút vì hệ thống có giới hạn số lần gửi. Trường hợp cuối cùng thì báo lại email này, bên mình đặt lại thủ công cho bạn.'],
            ['Bùi Thị Lan', 'lanbui.tea@gmail.com', '0905220088', 'Lan Trà & Bánh', 15,
             'Cho mình hỏi phí gói Pro 12 tháng có xuất hoá đơn đỏ được không ạ? Quán mình cần để kê khai.', true,
             'Chào bạn, hiện tại hệ thống có ghi nhận VAT 10% trong từng hoá đơn mua gói và bạn tải lại được ở mục Gói dịch vụ. Về hoá đơn điện tử theo mẫu của cơ quan thuế thì bên mình đang làm, dự kiến có trong bản cập nhật tới.'],
            ['Ngô Văn Cường', 'cuongngo.cafe@gmail.com', '0905220099', 'Cường Coffee House', 18,
             'Mình lỡ xoá nhầm một món trong thực đơn, có khôi phục lại được không?', true,
             'Chào bạn, món đã xoá thì không khôi phục tự động được, nhưng các hoá đơn cũ vẫn giữ nguyên tên và giá món tại thời điểm bán nên số liệu doanh thu không bị ảnh hưởng. Bạn tạo lại món với tên cũ là dùng tiếp bình thường.'],
            ['Trịnh Thu Hương', 'huongtrinh.brew@gmail.com', '0905220110', 'Hương Cafe Sân Thượng', 22,
             'Bên mình muốn nhân viên chỉ được bán hàng, không xem được doanh thu. Có phân quyền như vậy chưa?', true,
             'Chào bạn, bản hiện tại mỗi quán dùng chung một tài khoản chủ quán nên chưa tách quyền riêng cho nhân viên. Đây là việc bên mình đã ghi nhận và xếp vào nhóm ưu tiên, sẽ báo lại bạn khi có.'],
            ['Lâm Gia Huy', 'huylam.cafe@gmail.com', '0905220121', 'Huy Cà Phê Vợt', 28,
             'Mình thanh toán VNPay xong nhưng gói chưa được kích hoạt, nhờ kiểm tra giúp mình.', true,
             'Chào bạn, mình đã kiểm tra và giao dịch của bạn đã về, gói đã được kích hoạt trong tài khoản. Trường hợp này thường do bạn đóng trang trong lúc VNPay đang chuyển về. Bạn đăng xuất rồi đăng nhập lại là thấy gói mới nhé.'],
            ['Đặng Khánh Ly', 'lydang.tea@gmail.com', '0905220132', 'Ly Tea Corner', 35,
             'Phần mềm có chạy được khi mất mạng không? Chỗ mình wifi hay chập chờn.', true,
             'Chào bạn, hệ thống cần mạng để lưu đơn nên khi mất mạng sẽ không thanh toán được. Tuy vậy màn hình sẽ báo rõ và không làm mất đơn đang mở — có mạng lại là bấm tiếp. Bạn cân nhắc gắn thêm một sim 4G dự phòng cho máy ở quầy.'],
        ];

        $docs = [];
        foreach ($rows as [$name, $email, $phone, $cafeName, $daysAgo, $content, $isRead, $reply]) {
            $at = $this->now->copy()->subDays($daysAgo)->setTime(mt_rand(8, 22), mt_rand(0, 59));
            $doc = [
                '_id' => new ObjectId(), 'full_name' => $name, 'email' => $email,
                'phone' => $phone, 'cafe_name' => $cafeName, 'content' => $content,
                'is_read' => $isRead,
                'created_at' => $this->ts($at),
            ];

            if ($reply !== null) {
                $doc['reply'] = $reply;
                $doc['replied_at'] = $this->ts($at->copy()->addHours(mt_rand(2, 30)));
                $doc['replied_by'] = 'Admin FunCafe';
            }

            $docs[] = $doc;
        }

        $this->insert('contact_messages', $docs);
    }

    // ------------------------------------------------------------------ chỉ mục

    private function createIndexes(): void
    {
        // Mỗi chủ quán chỉ có MỘT đánh giá hiện hành — ràng buộc này được thực thi ở
        // tầng CSDL chứ không chỉ trong ReviewController, để hai request song song
        // không chèn được hai bản.
        //
        // Bỏ qua khi ĐÃ CÓ chỉ mục cùng bộ khóa, dù nó mang tên khác: `db:indexes` đặt
        // tên `uniq_email` cho users.email, nếu ở đây cứ tạo `uniq_user_email` thì Mongo
        // coi là xung đột và ném lỗi — seeder chết ngay sau khi đã ghi xong dữ liệu.
        $chiMuc = [
            ['reviews', ['user_id' => 1], 'uniq_user_review'],
            ['users', ['email' => 1], 'uniq_email'],
        ];

        foreach ($chiMuc as [$col, $keys, $name]) {
            $daCo = false;
            foreach ($this->db->selectCollection($col)->listIndexes() as $ix) {
                if ($ix->getKey() === $keys) {
                    $daCo = true;
                    break;
                }
            }

            if ($daCo) {
                $this->command->line("  sẵn có chỉ mục {$col} " . json_encode($keys));
                continue;
            }

            $this->db->selectCollection($col)->createIndex($keys, ['unique' => true, 'name' => $name]);
            $this->command->info("  đã tạo chỉ mục {$name}");
        }
    }

    private function summary(): void
    {
        $this->command->info('');
        $this->command->info('Kết quả:');
        foreach (['users', 'cafes', 'packages', 'time_subscriptions', 'subscriptions', 'package_payments',
                  'categories', 'items', 'item_prices', 'toppings', 'item_toppings', 'tables',
                  'orders', 'order_details', 'order_detail_toppings', 'reviews', 'contact_messages'] as $c) {
            $this->command->info(sprintf('  %-24s %6d', $c, $this->db->selectCollection($c)->countDocuments()));
        }
    }
}
