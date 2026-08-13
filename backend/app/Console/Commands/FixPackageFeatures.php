<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Đưa `packages.features` về mảng BSON đúng chuẩn.
 *
 * Model `Package` từng cast `features => 'array'`. Cast đó `json_encode` giá trị trước
 * khi ghi, nên trong MongoDB trường này nằm dưới dạng CHUỖI `"[\"a\",\"b\"]"` thay vì
 * mảng. Đọc qua model vẫn ra mảng nên không ai thấy gì sai — cho tới khi bỏ cast đi:
 * lúc đó máy chủ trả nguyên chuỗi ra API và `features.map(...)` ở giao diện nổ, trang
 * Bảng giá công khai trắng trơn.
 *
 * `Package::getFeaturesAttribute()` đã đọc được cả hai dạng nên hệ thống không còn hỏng
 * dù chưa chạy lệnh này. Lệnh này để dữ liệu về đúng chuẩn: khớp ERD, và truy vấn được
 * bằng toán tử mảng của Mongo.
 *
 * Chạy lại được nhiều lần: lượt sau không còn gì để đổi.
 *
 *   php artisan db:fix-package-features           # chỉ xem
 *   php artisan db:fix-package-features --apply   # ghi thật
 */
class FixPackageFeatures extends Command
{
    protected $signature = 'db:fix-package-features {--apply : Ghi thật vào CSDL (mặc định chỉ báo cáo)}';

    protected $description = 'Đưa packages.features từ chuỗi JSON về mảng BSON';

    public function handle(): int
    {
        $ghiThat = (bool) $this->option('apply');
        $coll = DB::connection('mongodb')->getDatabase()->selectCollection('packages');

        $this->info($ghiThat ? 'CHẾ ĐỘ GHI THẬT' : 'Chế độ chỉ xem — thêm --apply để ghi thật.');
        $this->newLine();

        $can = 0;
        $daSua = 0;
        $hong = 0;

        foreach ($coll->find() as $goi) {
            $ten = $goi['name'] ?? '(không tên)';
            $gt = $goi['features'] ?? null;

            if (!is_string($gt)) {
                $this->line(sprintf('  %-10s đã đúng dạng mảng', $ten));
                continue;
            }

            $mang = json_decode($gt, true);
            if (!is_array($mang)) {
                $this->error(sprintf('  %-10s là chuỗi nhưng KHÔNG giải mã được — bỏ qua để người xem quyết định', $ten));
                $hong++;
                continue;
            }

            $can++;
            $this->warn(sprintf('  %-10s chuỗi JSON %d mục -> mảng', $ten, count($mang)));

            if ($ghiThat) {
                $coll->updateOne(['_id' => $goi['_id']], ['$set' => ['features' => $mang]]);
                $daSua++;
            }
        }

        $this->newLine();

        if ($can === 0) {
            $this->info('Mọi gói đã lưu features ở dạng mảng. Không có gì để làm.');
            return $hong ? self::FAILURE : self::SUCCESS;
        }

        $this->info($ghiThat
            ? "Đã sửa {$daSua} gói."
            : "Có {$can} gói đang lưu dạng chuỗi. Chạy lại kèm --apply để sửa.");

        return $hong ? self::FAILURE : self::SUCCESS;
    }
}
