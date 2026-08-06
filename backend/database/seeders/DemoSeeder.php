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
                'description' => 'Đầy đủ chức năng + doanh thu (tối đa 10 bàn, 15 món)',
                'features' => [
                    'Quản lý thông tin quán',
                    'Tối đa 10 bàn',
                    'Thực đơn tối đa 15 món',
                    'Quản lý size & topping',
                    'Bán hàng theo bàn',
                    'Quản lý order & hóa đơn',
                    'In & xuất PDF hóa đơn',
                    'Thống kê & biểu đồ doanh thu',
                ],
                'max_tables' => 10, 'max_menu_items' => 15, 'can_use_ai' => false,
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
        // Quán 1 — Fun Free, CÒN 5 NGÀY: để giao diện hiện cảnh báo sắp hết hạn.
        $c1 = $this->makeCafe($ownerId, 'Cafe Góc Nhỏ', '48 Trần Hưng Đạo, Q.5, TP.HCM', '0912345601',
            'Quán cà phê phin nhỏ trong hẻm, khách quen là chính.', '970436', '0071000123456', 'NGUYEN MINH NHUT');
        $this->menuGocNho($c1);
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
        $this->makeOrders($c1, 45, 2, 6);

        // Quán 2 — Pro: chạm đúng trần gói (10 bàn / 15 món) để giới hạn nhìn thấy được.
        $c2 = $this->makeCafe($ownerId, 'Trà Sữa MiMi', '215 Nguyễn Văn Cừ, Q.1, TP.HCM', '0912345602',
            'Trà sữa pha máy, đủ size và topping, khách trẻ.', '970407', '19036789012345', 'NGUYEN MINH NHUT');
        $this->menuMiMi($c2);
        $this->makeTables($c2, 10);
        $sub2 = $this->makeSubscription($c2, self::PKG_PRO, 'Pro', '6a3e50c13a064fb807035547',
            $this->now->copy()->subDays(30), $this->now->copy()->addDays(60), 549000);
        $this->makePayment($ownerId, $c2, self::PKG_PRO, '6a3e50c13a064fb807035547', $sub2,
            549000, 'vnpay', $this->now->copy()->subDays(30));
        $this->makeOrders($c2, 60, 5, 11);

        // Quán 3 — Pro Max: quán lớn nhất, doanh thu cao nhất, có AI.
        $c3 = $this->makeCafe($ownerId, 'The Brew House', '12 Lê Lợi, Q.1, TP.HCM', '0912345603',
            'Quán rang xay specialty, có bánh và chỗ ngồi làm việc.', '970422', '0031000998877', 'NGUYEN MINH NHUT');
        $this->menuBrewHouse($c3);
        $this->makeTables($c3, 18);
        $sub3 = $this->makeSubscription($c3, self::PKG_PROMAX, 'Pro Max', '6a3e50c13a064fb80703554b',
            $this->now->copy()->subDays(60), $this->now->copy()->addDays(305), 4990000);
        $this->makePayment($ownerId, $c3, self::PKG_PROMAX, '6a3e50c13a064fb80703554b', $sub3,
            4990000, 'momo', $this->now->copy()->subDays(60));
        $this->makeOrders($c3, 90, 7, 16);
    }

    private function makeCafe(string $userId, string $name, string $addr, string $phone,
                              string $desc, string $bin, string $acc, string $accName): string
    {
        $id = (string) new ObjectId();
        $this->insert('cafes', [[
            '_id' => new ObjectId($id), 'user_id' => $userId, 'name' => $name,
            'address' => $addr, 'phone' => $phone, 'description' => $desc,
            'logo' => null, 'status' => 'open',
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
     * Nạp thực đơn từ mô tả gọn: mỗi danh mục là [tên => [ [tên món, giá, sizes, cho topping], ... ] ].
     * $sizes rỗng = món một giá (base_price); có sizes = base_price 0 + các dòng item_prices.
     */
    private function makeMenu(string $cafeId, array $tree, array $toppings = []): void
    {
        $created = $this->ts($this->now->copy()->subDays(118));

        $toppingIds = [];
        if ($toppings) {
            $docs = [];
            foreach ($toppings as [$name, $price]) {
                $tid = (string) new ObjectId();
                $toppingIds[] = $tid;
                $docs[] = [
                    '_id' => new ObjectId($tid), 'cafe_id' => $cafeId, 'name' => $name,
                    'price' => $price, 'image' => null, 'is_available' => true,
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

            foreach ($rows as [$name, $price, $sizes, $allowTopping]) {
                $itemId = (string) new ObjectId();
                $items[] = [
                    '_id' => new ObjectId($itemId), 'cafe_id' => $cafeId, 'category_id' => $catId,
                    'name' => $name, 'description' => null, 'image' => null,
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

    private function menuGocNho(string $cafeId): void
    {
        // Quán phin truyền thống: một giá, không size, không topping.
        $this->makeMenu($cafeId, [
            'Cà phê' => [
                ['Cà phê phin đen', 20000, [], false],
                ['Cà phê sữa đá', 25000, [], false],
                ['Bạc xỉu', 30000, [], false],
                ['Cà phê muối', 32000, [], false],
                ['Cà phê dừa', 35000, [], false],
            ],
            'Trà' => [
                ['Trà đào cam sả', 35000, [], false],
                ['Trà vải', 33000, [], false],
                ['Trà gừng mật ong', 30000, [], false],
            ],
            'Bánh ngọt' => [
                ['Bánh flan', 15000, [], false],
                ['Croissant bơ', 28000, [], false],
            ],
        ]);
    }

    private function menuMiMi(string $cafeId): void
    {
        // ĐÚNG 15 món và 10 bàn — chạm trần gói Pro, để giới hạn nhìn thấy được ngay.
        $s = fn (int $a, int $b, int $c) => ['S' => $a, 'M' => $b, 'L' => $c];

        $this->makeMenu($cafeId, [
            'Trà sữa' => [
                ['Trà sữa truyền thống', 0, $s(30000, 35000, 42000), true],
                ['Trà sữa khoai môn', 0, $s(32000, 38000, 45000), true],
                ['Trà sữa trân châu đường đen', 0, $s(35000, 42000, 50000), true],
                ['Hồng trà sữa', 0, $s(30000, 36000, 43000), true],
                ['Trà sữa matcha', 0, $s(35000, 42000, 49000), true],
                ['Trà sữa socola', 0, $s(33000, 39000, 46000), true],
            ],
            'Trà trái cây' => [
                ['Trà đào cam sả', 0, $s(35000, 42000, 49000), true],
                ['Trà vải thanh long', 0, $s(35000, 42000, 49000), true],
                ['Trà chanh dây', 0, $s(32000, 38000, 45000), true],
                ['Trà xoài nhiệt đới', 0, $s(36000, 43000, 50000), true],
                ['Trà dâu tây', 0, $s(36000, 43000, 50000), true],
            ],
            'Đá xay' => [
                ['Matcha đá xay', 0, $s(45000, 52000, 59000), true],
                ['Socola đá xay', 0, $s(45000, 52000, 59000), true],
                ['Cookie đá xay', 0, $s(48000, 55000, 62000), true],
                ['Caramel đá xay', 0, $s(48000, 55000, 62000), true],
            ],
        ], [
            ['Trân châu đen', 7000],
            ['Trân châu trắng', 7000],
            ['Thạch dừa', 6000],
            ['Pudding trứng', 8000],
            ['Kem cheese', 10000],
        ]);
    }

    private function menuBrewHouse(string $cafeId): void
    {
        $s = fn (int $a, int $b) => ['M' => $a, 'L' => $b];

        $this->makeMenu($cafeId, [
            'Espresso Bar' => [
                ['Espresso', 40000, [], true],
                ['Americano', 0, $s(45000, 55000), true],
                ['Latte', 0, $s(55000, 65000), true],
                ['Cappuccino', 0, $s(55000, 65000), true],
                ['Flat White', 58000, [], true],
                ['Mocha', 0, $s(62000, 72000), true],
                ['Caramel Macchiato', 0, $s(65000, 75000), true],
            ],
            'Cold Brew & Pour Over' => [
                ['Cold Brew nguyên bản', 0, $s(60000, 72000), false],
                ['Cold Brew sữa yến mạch', 0, $s(72000, 85000), false],
                ['Nitro Cold Brew', 85000, [], false],
                ['V60 Ethiopia Yirgacheffe', 90000, [], false],
                ['V60 Colombia Huila', 88000, [], false],
            ],
            'Signature' => [
                ['Cà phê trứng Hà Nội', 65000, [], false],
                ['Espresso Tonic', 70000, [], false],
                ['Cà phê dừa đá xay', 68000, [], true],
                ['Bơ cà phê', 72000, [], false],
                ['Sữa chua cà phê', 60000, [], false],
            ],
            'Bánh & Ăn nhẹ' => [
                ['Croissant hạnh nhân', 45000, [], false],
                ['Tiramisu', 65000, [], false],
                ['Cheesecake chanh dây', 62000, [], false],
                ['Brownie socola đen', 55000, [], false],
                ['Bánh mì bơ tỏi', 38000, [], false],
            ],
        ], [
            ['Thêm 1 shot espresso', 15000],
            ['Syrup hạnh nhân', 8000],
            ['Syrup caramel', 8000],
            ['Kem tươi', 10000],
        ]);
    }

    // ------------------------------------------------------------------ gói/đơn

    private function makeSubscription(string $cafeId, string $pkgId, string $pkgName,
                                      string $timeSubId, Carbon $start, Carbon $end, int $subtotal): string
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
            'action_type' => 'new',
            'created_at' => $this->ts($start),
        ]]);

        return $id;
    }

    private function makePayment(string $userId, string $cafeId, string $pkgId, string $timeSubId,
                                 string $subId, int $subtotal, string $method, Carbon $at): void
    {
        $vat = (int) round($subtotal * self::VAT / 100);
        $seq = str_pad((string) mt_rand(1, 99), 4, '0', STR_PAD_LEFT);

        $this->insert('package_payments', [[
            '_id' => new ObjectId(), 'user_id' => $userId, 'cafe_id' => $cafeId,
            'package_id' => $pkgId, 'time_subscription_id' => $timeSubId, 'subscription_id' => $subId,
            'subtotal' => $subtotal, 'vat_rate' => self::VAT, 'vat_amount' => $vat,
            'amount' => $subtotal + $vat,
            'payment_method' => $method, 'payment_status' => 'paid',
            'transaction_code' => 'TXN-' . $at->format('Ymd') . '-' . $seq,
            'note' => null, 'paid_at' => $this->ts($at),
            'action_type' => 'new', 'credit_amount' => 0,
            'gateway_txn_no' => in_array($method, ['vnpay', 'momo'], true) ? (string) mt_rand(10000000, 99999999) : null,
            'created_at' => $this->ts($at),
        ]]);
    }

    /**
     * Sinh đơn hàng ĐÃ THANH TOÁN rải theo ngày.
     * Doanh thu chỉ tính order có status='paid' VÀ payment_status='paid' (xem
     * UserRevenueController), nên cả hai đều phải được đặt.
     */
    private function makeOrders(string $cafeId, int $days, int $min, int $max): void
    {
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
        $people = [
            ['Trần Thị Mỹ Duyên', 'duyen.tran@gmail.com', '0903111222', 'Cà Phê Sân Vườn Duyên', '15 Phan Xích Long, Phú Nhuận, TP.HCM', self::PKG_PROMAX, '6a3e50c13a064fb80703554b', 4990000, 6, 'vnpay'],
            ['Lê Hoàng Nam', 'namle.cafe@gmail.com', '0903111333', 'Nam Coffee Roastery', '88 Nguyễn Trãi, Q.5, TP.HCM', self::PKG_PRO, '6a3e50c13a064fb807035548', 1990000, 6, 'momo'],
            ['Phạm Quốc Huy', 'huypham2000@gmail.com', '0903111444', 'Huy Tea & Coffee', '204 Lý Thường Kiệt, Q.10, TP.HCM', self::PKG_PRO, '6a3e50c13a064fb807035547', 549000, 5, 'vnpay'],
            ['Nguyễn Thị Bích Ngọc', 'ngocnguyen.tea@gmail.com', '0903111555', 'Ngọc Milk Tea', '32 Hùng Vương, TP. Cần Thơ', self::PKG_PROMAX, '6a3e50c13a064fb80703554a', 1399000, 4, 'momo'],
            ['Võ Thành Đạt', 'datvo.brew@gmail.com', '0903111666', 'Đạt Brew Lab', '7 Bạch Đằng, TP. Đà Nẵng', self::PKG_PRO, '6a3e50c13a064fb807035546', 199000, 4, 'vnpay'],
            ['Đặng Thu Hà', 'hadang.coffee@gmail.com', '0903111777', 'Hà Coffee House', '120 Trần Phú, TP. Nha Trang', self::PKG_FREE, '6a3e50c13a064fb807035545', 0, 3, null],
            ['Bùi Minh Khoa', 'khoabui.cafe@gmail.com', '0903111888', 'Khoa Specialty', '55 Lê Duẩn, TP. Huế', self::PKG_PROMAX, '6a3e50c13a064fb807035549', 499000, 3, 'vnpay'],
            ['Hồ Thị Kim Anh', 'kimanh.ho@gmail.com', '0903111999', 'Kim Anh Trà Sữa', '9 Nguyễn Huệ, TP. Vũng Tàu', self::PKG_PRO, '6a3e50c13a064fb807035547', 549000, 2, 'momo'],
            ['Trương Gia Bảo', 'baotruong.dev@gmail.com', '0903112000', 'Bảo Cafe Sách', '77 Hai Bà Trưng, TP. Đà Lạt', self::PKG_FREE, '6a3e50c13a064fb807035545', 0, 2, null],
            ['Lý Thanh Tùng', 'tunglythanh@gmail.com', '0903112111', 'Tùng Coffee Station', '3 Quang Trung, TP. Biên Hòa', self::PKG_PRO, '6a3e50c13a064fb807035546', 199000, 1, 'momo'],
        ];

        // Đánh giá: MỖI NGƯỜI TỐI ĐA MỘT (có unique index trên reviews.user_id).
        $reviewText = [
            0 => [5, 'Quản lý nhiều quán rất tiện', 'Mình có 2 chi nhánh, trước phải ghi sổ riêng từng nơi. Giờ đổi quán ngay trên thanh công cụ, doanh thu vẫn tách bạch.'],
            1 => [5, 'Đóng ca nhanh hơn hẳn', 'Cuối ngày chỉ cần mở mục doanh thu là ra đủ số, không phải cộng tay hóa đơn nữa.'],
            2 => [4, 'Dùng ổn, mong có thêm app điện thoại', 'Bán hàng theo bàn rõ ràng, nhân viên mới một buổi là quen. Nếu có ứng dụng riêng cho điện thoại thì tiện hơn.'],
            3 => [5, 'Size và topping đúng nhu cầu quán trà sữa', 'Mỗi món ba size, topping cấu hình riêng từng món nên order không bị nhầm.'],
            6 => [5, 'Trợ lý AI phân tích doanh thu khá hữu ích', 'Hỏi tháng này bán chậm món nào là nó chỉ ra ngay, đỡ phải ngồi lọc bảng.'],
            7 => [4, 'Giao diện dễ nhìn, giá hợp lý', 'Gói Pro đủ cho quán nhỏ của mình. In hóa đơn nhanh, khách không phải chờ.'],
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

            // Gói mua ngay sau khi đăng ký; gói trả phí còn hạn dài để không quán nào hết hạn oan.
            $start = $joined->copy()->addDays(mt_rand(0, 3));
            $end = $price > 0 ? $start->copy()->addMonths(12) : $start->copy()->addDays(7);
            $subId = (string) new ObjectId();
            $vat = (int) round($price * self::VAT / 100);

            $subs[] = [
                '_id' => new ObjectId($subId), 'cafe_id' => $cid, 'package_id' => $pkgId,
                'time_subscription_id' => $timeSubId,
                'package_name_snapshot' => $pkgId === self::PKG_PRO ? 'Pro' : ($pkgId === self::PKG_PROMAX ? 'Pro Max' : 'Fun Free'),
                'start_date' => $this->ts($start), 'end_date' => $this->ts($end),
                'status' => 'active',
                'subtotal' => $price, 'vat_rate' => self::VAT, 'vat_amount' => $vat,
                'total_amount' => $price + $vat,
                'action_type' => 'new',
                'created_at' => $this->ts($start),
            ];

            if ($price > 0) {
                $this->makePayment($uid, $cid, $pkgId, $timeSubId, $subId, $price, $gateway, $start);
            }

            if (isset($reviewText[$i])) {
                [$rating, $title, $comment] = $reviewText[$i];
                $reviews[] = [
                    '_id' => new ObjectId(), 'user_id' => $uid, 'cafe_id' => $cid,
                    'package_id' => $pkgId, 'rating' => $rating,
                    'title' => $title, 'comment' => $comment,
                    'status' => 'visible', 'history' => [],
                    'created_at' => $this->ts($start->copy()->addDays(mt_rand(10, 40))),
                ];
            }
        }

        $this->insert('users', $users);
        $this->insert('cafes', $cafes);
        $this->insert('subscriptions', $subs);
        $this->insert('reviews', $reviews);
    }

    // ------------------------------------------------------------------ chỉ mục

    private function createIndexes(): void
    {
        // Mỗi chủ quán chỉ có MỘT đánh giá hiện hành — ràng buộc này được thực thi ở
        // tầng CSDL chứ không chỉ trong ReviewController, để hai request song song
        // không chèn được hai bản.
        $this->db->selectCollection('reviews')->createIndex(['user_id' => 1], ['unique' => true, 'name' => 'uniq_user_review']);
        $this->db->selectCollection('users')->createIndex(['email' => 1], ['unique' => true, 'name' => 'uniq_user_email']);
        $this->command->info('  đã tạo chỉ mục uniq_user_review + uniq_user_email');
    }

    private function summary(): void
    {
        $this->command->info('');
        $this->command->info('Kết quả:');
        foreach (['users', 'cafes', 'packages', 'time_subscriptions', 'subscriptions', 'package_payments',
                  'categories', 'items', 'item_prices', 'toppings', 'item_toppings', 'tables',
                  'orders', 'order_details', 'order_detail_toppings', 'reviews'] as $c) {
            $this->command->info(sprintf('  %-24s %6d', $c, $this->db->selectCollection($c)->countDocuments()));
        }
    }
}
