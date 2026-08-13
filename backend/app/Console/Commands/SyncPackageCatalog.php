<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use MongoDB\BSON\ObjectId;

/**
 * Đồng bộ ĐỊNH NGHĨA gói dịch vụ và mốc thời hạn từ tệp JSON vào CSDL.
 *
 * Vì sao cần một lệnh riêng: `ProductionSeeder` cố tình chỉ nạp khi collection còn
 * RỖNG. Đó là lựa chọn đúng — nó chạy mỗi lần container khởi động lại, mà quản trị
 * viên có thể đã sửa gói qua giao diện; ghi đè mỗi lần khởi động là âm thầm xóa công
 * sửa của người ta.
 *
 * Nhưng hệ quả là: đổi hạn mức gói trong mã rồi triển khai lại thì CSDL KHÔNG đổi
 * theo. Đã xảy ra thật — hạn mức Pro nâng lên 20 bàn / 40 món trong mã, còn bản trên
 * mạng vẫn quảng cáo và vẫn thực thi 10 bàn / 15 món. Trang bảng giá nói một đằng,
 * hệ thống làm một nẻo, và không ai được báo gì.
 *
 * Lệnh này là chỗ để làm việc đó MỘT CÁCH CÓ CHỦ Ý: chạy khi bảng giá thật sự đổi,
 * không chạy tự động. Mặc định chỉ in ra khác biệt từng trường; phải gõ `--apply`
 * mới ghi.
 *
 * Chạy trên bản đã triển khai (Render bậc miễn phí không có Shell) bằng cách trỏ
 * lệnh ở máy mình sang CSDL trên mạng:
 *
 *   MONGODB_DSN="mongodb+srv://..." php artisan db:sync-packages
 *   MONGODB_DSN="mongodb+srv://..." php artisan db:sync-packages --apply
 */
class SyncPackageCatalog extends Command
{
    protected $signature = 'db:sync-packages {--apply : Ghi thật vào CSDL (mặc định chỉ báo cáo)}';

    protected $description = 'Đồng bộ định nghĩa gói và mốc thời hạn từ tệp JSON vào CSDL';

    /** Chỉ những trường thuộc về ĐỊNH NGHĨA gói. Không đụng gì khác trong tài liệu. */
    private const TRUONG_GOI = [
        'name', 'type', 'level', 'is_trial', 'description',
        'features', 'max_tables', 'max_menu_items', 'can_use_ai',
    ];

    private const TRUONG_THOI_HAN = [
        'package_id', 'duration_value', 'duration_unit', 'price', 'label',
    ];

    public function handle(): int
    {
        $ghiThat = (bool) $this->option('apply');

        $this->info($ghiThat ? 'CHẾ ĐỘ GHI THẬT' : 'Chế độ chỉ xem — thêm --apply để ghi thật.');
        $this->line('CSDL: ' . config('database.connections.mongodb.database'));
        $this->newLine();

        $tong = 0;
        $tong += $this->dongBo('packages', __DIR__ . '/../../../database/seeders/data/packages.json', self::TRUONG_GOI, 'name', $ghiThat);
        $tong += $this->dongBo('time_subscriptions', __DIR__ . '/../../../database/seeders/data/time_subscriptions.json', self::TRUONG_THOI_HAN, 'label', $ghiThat);

        $this->newLine();

        if ($tong === 0) {
            $this->info('CSDL đã khớp với tệp định nghĩa. Không có gì để làm.');
            return self::SUCCESS;
        }

        $this->info($ghiThat
            ? "Đã cập nhật {$tong} trường."
            : "Có {$tong} trường lệch. Chạy lại kèm --apply để đồng bộ.");

        return self::SUCCESS;
    }

    private function dongBo(string $bang, string $tep, array $cacTruong, string $nhan, bool $ghiThat): int
    {
        if (!File::exists($tep)) {
            $this->warn("Bỏ qua {$bang}: không thấy {$tep}");
            return 0;
        }

        $coll = DB::connection('mongodb')->getDatabase()->selectCollection($bang);
        $dinhNghia = json_decode(File::get($tep), true) ?: [];
        $soLech = 0;

        $this->line("── {$bang}");

        foreach ($dinhNghia as $mong) {
            $id = $mong['_id']['$oid'] ?? null;
            if (!$id) {
                continue;
            }

            $dangCo = $coll->findOne(['_id' => new ObjectId($id)]);
            $ten = $mong[$nhan] ?? $id;

            if (!$dangCo) {
                $this->warn(sprintf('  %-14s CHƯA CÓ trong CSDL — dùng ProductionSeeder để nạp lần đầu', $ten));
                continue;
            }

            $doi = [];
            foreach ($cacTruong as $truong) {
                if (!array_key_exists($truong, $mong)) {
                    continue;
                }

                $moi = $mong[$truong];
                $cu = $dangCo[$truong] ?? null;
                $cu = is_object($cu) && method_exists($cu, 'getArrayCopy') ? $cu->getArrayCopy() : $cu;
                // Chuỗi JSON là di sản của cast 'array' cũ — xem FixPackageFeatures.
                if (is_string($cu) && is_array($moi)) {
                    $giai = json_decode($cu, true);
                    if (is_array($giai)) {
                        $cu = $giai;
                    }
                }

                if ($cu != $moi) {
                    $doi[$truong] = $moi;
                    $this->line(sprintf('  %-14s %-16s %s  ->  %s', $ten, $truong, $this->gonGang($cu), $this->gonGang($moi)));
                    $soLech++;
                }
            }

            if ($doi && $ghiThat) {
                $coll->updateOne(['_id' => new ObjectId($id)], ['$set' => $doi]);
            }
        }

        if ($soLech === 0) {
            $this->line('  (khớp)');
        }

        return $soLech;
    }

    /** Rút gọn một giá trị cho vừa một dòng log. */
    private function gonGang($v): string
    {
        if (is_array($v)) {
            return count($v) . ' mục';
        }
        if (is_bool($v)) {
            return $v ? 'true' : 'false';
        }
        if ($v === null) {
            return 'null';
        }

        $s = (string) $v;
        return mb_strlen($s) > 34 ? mb_substr($s, 0, 31) . '...' : $s;
    }
}
