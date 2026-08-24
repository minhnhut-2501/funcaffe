<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use MongoDB\Driver\Exception\CommandException;
use Throwable;

/**
 * Đổi tên collection và trường trong MongoDB cho lần đổi tên `cafe -> shop`,
 * `item -> product` (GVHD yêu cầu, xem doc/ERD.md).
 *
 * Vì sao là một lệnh riêng chứ không phải migration: dữ liệu nghiệp vụ nằm hết ở
 * MongoDB, mà Mongo KHÔNG đi qua migration của Laravel — thư mục database/migrations
 * chỉ có mấy bảng SQLite cho token Sanctum. Giống hệt lý do của `db:indexes`.
 *
 * CHẠY LẠI ĐƯỢC BAO NHIÊU LẦN CŨNG KHÔNG HỎNG. Đây là ràng buộc bắt buộc chứ không
 * phải tiện nghi: Mongo máy đơn không có transaction, nên lệnh dừng giữa chừng (mất
 * mạng tới Atlas, Ctrl-C) là chuyện phải tính trước. Mỗi bước tự kiểm điều kiện của
 * chính nó:
 *   - đổi tên collection: chỉ làm khi nguồn CÒN và đích CHƯA có
 *   - đổi tên trường: chỉ chạm document còn mang tên cũ ($exists)
 * Chạy lần hai chỉ in ra "đã xong" chứ không ghi gì thêm.
 *
 *   php artisan db:doi-ten-schema --kiem-tra   # chạy khô, không ghi gì
 *   php artisan db:doi-ten-schema              # làm thật
 *
 * SAU KHI CHẠY PHẢI GỌI `php artisan db:indexes` — chỉ mục cũ trỏ vào trường vừa bị
 * đổi tên nên không còn tác dụng, và lệnh đó lo cả việc dọn chúng đi.
 */
class RenameSchemaToShopProduct extends Command
{
    protected $signature = 'db:doi-ten-schema {--kiem-tra : Chạy khô — chỉ in ra sẽ đổi những gì, không ghi}';
    protected $description = 'Đổi tên collection/trường: cafe -> shop, item -> product';

    /** Tên collection cũ => tên mới. Collection `tables` giữ nguyên tên (đã rõ nghĩa). */
    private const COLLECTIONS = [
        'cafes'          => 'shops',
        'items'          => 'products',
        'item_prices'    => 'product_sizes',
        'item_toppings'  => 'product_toppings',
    ];

    /**
     * Đổi tên trường, khai theo TÊN COLLECTION MỚI (chạy sau bước đổi tên collection).
     *
     * @var array<string, array<string, string>>
     */
    private const FIELDS = [
        'subscriptions'    => ['cafe_id' => 'shop_id'],
        'package_payments' => ['cafe_id' => 'shop_id'],
        'tables'           => ['cafe_id' => 'shop_id'],
        'categories'       => ['cafe_id' => 'shop_id'],
        'toppings'         => ['cafe_id' => 'shop_id'],
        'orders'           => ['cafe_id' => 'shop_id'],
        'reviews'          => ['cafe_id' => 'shop_id'],
        'products'         => ['cafe_id' => 'shop_id', 'allow_topping' => 'has_topping'],
        'product_sizes'    => ['item_id' => 'product_id'],
        'product_toppings' => ['item_id' => 'product_id'],
        'order_details'    => [
            'item_id'            => 'product_id',
            'item_name_snapshot' => 'product_name_snapshot',
            'item_price_id'      => 'product_size_id',
        ],
        // Sót ở lượt chạy 24/08: `contact_messages` KHÔNG có khóa ngoại nào nên khi
        // rà soát theo `cafe_id` thì nó không lọt vào danh sách. Nhưng nó có một
        // trường mang chữ "cafe" theo nghĩa khác — tên quán khách tự khai. Mã đã đọc
        // `shop_name`, dữ liệu cũ còn `cafe_name`, nên cột "Tên quán" ở khu quản trị
        // trống trơn với mọi tin nhắn cũ.
        'contact_messages' => ['cafe_name' => 'shop_name'],
    ];

    /**
     * Giá trị mặc định cho các trường SẼ dùng ở đợt sau (bán mang về, ẩn bàn).
     *
     * Đặt ngay từ đây có chủ đích: mỗi lần chạy migration trên Atlas là một lần rủi ro,
     * gộp một lượt hơn hẳn ba lượt. Hai giá trị này chắc chắn đúng cho dữ liệu cũ —
     * mọi đơn đã bán đều là bán tại quán, mọi bàn đang có đều đang dùng.
     *
     * @var array<string, array<string, mixed>>
     */
    private const DEFAULTS = [
        'orders' => ['order_type' => 'dine_in'],
        'tables' => ['is_active' => true],
    ];

    public function handle(): int
    {
        $khoTest = $this->option('kiem-tra');
        $db = DB::connection('mongodb')->getDatabase();

        if ($khoTest) {
            $this->warn('CHẠY KHÔ — không ghi gì vào cơ sở dữ liệu.');
        }

        $this->line('');
        $this->info('1/4  Đổi tên collection');
        $daCo = $this->tenCollectionDangCo($db);

        foreach (self::COLLECTIONS as $cu => $moi) {
            $coCu  = in_array($cu, $daCo, true);
            $coMoi = in_array($moi, $daCo, true);

            if (!$coCu && $coMoi) {
                $this->line("  đã xong  {$cu} -> {$moi}");
                continue;
            }
            if (!$coCu) {
                $this->line("  bỏ qua   {$cu} (không có trong CSDL này)");
                continue;
            }
            $soLuongCu = $db->selectCollection($cu)->countDocuments();

            if ($coMoi) {
                $soMoi = $db->selectCollection($moi)->countDocuments();

                if ($soMoi > 0) {
                    // Cả hai cùng có DỮ LIỆU: KHÔNG tự ý gộp. Đây là dấu hiệu ai đó đã
                    // nạp dữ liệu mới đè lên nửa chừng — đoán bừa ở đây là mất dữ liệu.
                    $this->error("  DỪNG    {$cu} ({$soLuongCu} doc) và {$moi} ({$soMoi} doc) cùng có dữ liệu. Phải xử lý tay rồi chạy lại.");
                    return self::FAILURE;
                }

                /*
                 * Đích tồn tại nhưng RỖNG -> nó không phải dữ liệu, mà là cái vỏ do
                 * `db:indexes` đẻ ra. Xóa đi rồi đổi tên như thường.
                 *
                 * Vì sao gặp: Dockerfile chạy `db:indexes` mỗi lần khởi động. Khi mã mới
                 * lên Render TRƯỚC lúc dữ liệu được đổi tên, lệnh đó tạo chỉ mục cho
                 * `shops`/`products`/... — mà tạo chỉ mục trên collection chưa có thì
                 * MongoDB tự sinh ra collection rỗng. Thế là đúng thứ tự triển khai
                 * đã khuyến nghị (deploy trước, đổi dữ liệu sau) lại tự chặn đường mình.
                 *
                 * Không có nhánh này thì lệnh dừng ở đây và người chạy phải vào Atlas
                 * xóa tay bốn collection — đúng lúc bản deploy đang hỏng.
                 */
                if ($khoTest) {
                    $this->line("  sẽ dọn   {$moi} (rỗng, do db:indexes tạo) rồi đổi {$cu} -> {$moi}");
                    continue;
                }
                $db->selectCollection($moi)->drop();
                $this->line("  dọn vỏ   {$moi} (rỗng, do db:indexes tạo)");
            }

            if ($khoTest) {
                $this->line("  sẽ đổi   {$cu} -> {$moi} ({$soLuongCu} document)");
                continue;
            }

            try {
                // renameCollection nằm ở database 'admin' và cần tên đầy đủ <db>.<coll>.
                // Chỉ mục đi theo collection nên không phải dựng lại ở bước này —
                // nhưng chỉ mục trên TRƯỜNG vừa đổi tên thì hỏng, xem db:indexes.
                $db->getManager()->executeCommand('admin', new \MongoDB\Driver\Command([
                    'renameCollection' => "{$db->getDatabaseName()}.{$cu}",
                    'to'               => "{$db->getDatabaseName()}.{$moi}",
                ]));
                $this->line("  đổi rồi  {$cu} -> {$moi} ({$soLuongCu} document)");
            } catch (CommandException $e) {
                $this->error("  LỖI     {$cu} -> {$moi}: " . $e->getMessage());
                return self::FAILURE;
            }
        }

        $this->line('');
        $this->info('2/4  Dọn chỉ mục cũ đang chặn đường');
        $this->line('  (chỉ mục nào có khóa là trường sắp đổi tên thì phải bỏ TRƯỚC, xem chú thích lớp)');

        foreach (self::FIELDS as $coll => $capTen) {
            $soi = $this->coCollection($db, $coll) ? $coll : $this->tenNguon($coll);
            if ($soi === null || !$this->coCollection($db, $soi)) {
                continue;
            }
            $tenCu = array_keys($capTen);

            foreach ($db->selectCollection($soi)->listIndexes() as $chiMuc) {
                $ten = $chiMuc->getName();
                if ($ten === '_id_') {
                    continue;   // không bao giờ bỏ chỉ mục khóa chính
                }
                $khoaDung = array_intersect(array_keys($chiMuc->getKey()), $tenCu);
                if ($khoaDung === []) {
                    continue;
                }

                if ($khoTest) {
                    $this->line("  sẽ bỏ    {$soi}.{$ten} (khóa: " . implode(', ', $khoaDung) . ')');
                    continue;
                }
                $db->selectCollection($soi)->dropIndex($ten);
                $this->line("  bỏ rồi   {$soi}.{$ten} (khóa: " . implode(', ', $khoaDung) . ')');
            }
        }

        $this->line('');
        $this->info('3/4  Đổi tên trường');
        $tongTruong = 0;

        foreach (self::FIELDS as $coll => $capTen) {
            // Ở CHẠY KHÔ, bước 1 chưa đổi tên nên `products` chưa tồn tại — soi vào
            // collection nguồn (`items`) để bản khô báo đúng số document sẽ đụng tới.
            // Không có đoạn này thì chạy khô im lặng bỏ qua đúng ba collection nặng
            // nhất, và người đọc tưởng là không có gì phải đổi.
            $soi = $this->coCollection($db, $coll) ? $coll : $this->tenNguon($coll);

            if ($soi === null || !$this->coCollection($db, $soi)) {
                $this->line("  bỏ qua   {$coll} (không có trong CSDL này)");
                continue;
            }
            $coll = $soi;

            foreach ($capTen as $cu => $moi) {
                // Chỉ chạm document CÒN mang tên cũ — đó là điều khiến lệnh chạy lại
                // được: lần hai bộ lọc khớp 0 document.
                $loc = [$cu => ['$exists' => true]];
                $con = $db->selectCollection($coll)->countDocuments($loc);

                if ($con === 0) {
                    $this->line("  đã xong  {$coll}.{$cu} -> {$moi}");
                    continue;
                }
                if ($khoTest) {
                    $this->line("  sẽ đổi   {$coll}.{$cu} -> {$moi} ({$con} document)");
                    $tongTruong += $con;
                    continue;
                }

                $kq = $db->selectCollection($coll)->updateMany($loc, ['$rename' => [$cu => $moi]]);
                $this->line("  đổi rồi  {$coll}.{$cu} -> {$moi} ({$kq->getModifiedCount()} document)");
                $tongTruong += $kq->getModifiedCount();
            }
        }

        $this->line('');
        $this->info('4/4  Giá trị mặc định cho trường mới');

        foreach (self::DEFAULTS as $coll => $truong) {
            if (!$this->coCollection($db, $coll)) {
                $this->line("  bỏ qua   {$coll} (không có trong CSDL này)");
                continue;
            }

            foreach ($truong as $ten => $giaTri) {
                $loc = [$ten => ['$exists' => false]];
                $con = $db->selectCollection($coll)->countDocuments($loc);

                if ($con === 0) {
                    $this->line("  đã xong  {$coll}.{$ten}");
                    continue;
                }
                if ($khoTest) {
                    $this->line("  sẽ đặt   {$coll}.{$ten} = " . json_encode($giaTri) . " ({$con} document)");
                    continue;
                }

                $kq = $db->selectCollection($coll)->updateMany($loc, ['$set' => [$ten => $giaTri]]);
                $this->line("  đặt rồi  {$coll}.{$ten} = " . json_encode($giaTri) . " ({$kq->getModifiedCount()} document)");
            }
        }

        $this->line('');
        if ($khoTest) {
            $this->info('Chạy khô xong — chưa ghi gì. Bỏ --kiem-tra để làm thật.');
            return self::SUCCESS;
        }

        $this->info('Xong. Bước bắt buộc tiếp theo: php artisan db:indexes');
        $this->warn('Chỉ mục cũ đang trỏ vào các trường vừa đổi tên nên không còn tác dụng — lệnh trên dựng lại và dọn chúng đi.');

        return self::SUCCESS;
    }

    /** @return string[] */
    private function tenCollectionDangCo($db): array
    {
        $ten = [];
        foreach ($db->listCollections() as $c) {
            $ten[] = $c->getName();
        }
        return $ten;
    }

    private function coCollection($db, string $ten): bool
    {
        return in_array($ten, $this->tenCollectionDangCo($db), true);
    }

    /** Tên CŨ của một collection đã được đổi tên, hoặc null nếu nó chưa từng đổi. */
    private function tenNguon(string $tenMoi): ?string
    {
        return array_search($tenMoi, self::COLLECTIONS, true) ?: null;
    }
}
