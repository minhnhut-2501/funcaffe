<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use MongoDB\BSON\Int64;

/**
 * Đưa mọi trường tiền trong MongoDB về SỐ NGUYÊN.
 *
 * Vì sao cần: đồng Việt Nam không có đơn vị nhỏ hơn đồng, nhưng `Order`,
 * `OrderDetail`, `OrderDetailTopping` và `Topping` từng ép kiểu 'float', nên các bản
 * ghi tạo ra trước khi sửa nằm trong CSDL dưới dạng `double` (7000.0 thay vì 7000).
 * Ứng dụng đọc qua model vẫn ra số nguyên nên nhìn ngoài không thấy gì sai — nhưng:
 *
 *  · ERD và mô tả trong báo cáo ghi "số nguyên", dữ liệu thật thì không;
 *  · truy vấn gộp chạy thẳng trên Mongo (không qua model) trả về số thực;
 *  · cộng nhiều dòng double tích lũy sai số nhị phân.
 *
 * MẶC ĐỊNH CHỈ BÁO CÁO. Phải gõ `--apply` mới ghi — đây là dữ liệu tiền, không ai
 * nên đổi nó vì lỡ tay gõ nhầm một lệnh.
 *
 * AN TOÀN: lệnh TỪ CHỐI đổi bất kỳ ô nào có phần thập phân. Ô như vậy nghĩa là có
 * một chỗ tính tiền đang sinh ra số lẻ; cắt nó đi là giấu lỗi và làm sai số tiền.
 * Lệnh sẽ liệt kê ra để người ta đi sửa chỗ tính, rồi chạy lại.
 *
 * Chạy được nhiều lần: lượt thứ hai không còn gì để đổi.
 *
 *   php artisan db:normalize-money           # chỉ xem
 *   php artisan db:normalize-money --apply   # ghi thật
 */
class NormalizeMoneyTypes extends Command
{
    protected $signature = 'db:normalize-money {--apply : Ghi thật vào CSDL (mặc định chỉ báo cáo)}';

    protected $description = 'Đưa mọi trường tiền trong MongoDB về số nguyên';

    /** Bảng → các trường mang giá trị tiền. */
    private const TRUONG_TIEN = [
        'products'              => ['base_price'],
        'product_sizes'           => ['price'],
        'toppings'              => ['price'],
        'orders'                => ['subtotal', 'discount_amount', 'total_amount', 'cash_received', 'change_amount'],
        'order_details'         => ['unit_price', 'subtotal', 'topping_total', 'total_price'],
        'order_detail_toppings' => ['price_at_time', 'subtotal'],
        'time_subscriptions'    => ['price'],
        'subscriptions'         => ['total_amount', 'subtotal', 'vat_amount'],
        'package_payments'      => ['amount', 'subtotal', 'vat_amount', 'credit_amount'],
    ];

    public function handle(): int
    {
        $ghiThat = (bool) $this->option('apply');
        $db = DB::connection('mongodb')->getDatabase();

        $this->info($ghiThat ? 'CHẾ ĐỘ GHI THẬT' : 'Chế độ chỉ xem — thêm --apply để ghi thật.');
        $this->newLine();

        $tongCanDoi = 0;
        $tongDaDoi = 0;
        $oLe = [];

        foreach (self::TRUONG_TIEN as $bang => $cacTruong) {
            $coll = $db->selectCollection($bang);

            foreach ($cacTruong as $truong) {
                $canDoi = [];

                foreach ($coll->find([$truong => ['$exists' => true]]) as $doc) {
                    $gt = $doc[$truong];
                    if (!is_float($gt)) {
                        continue; // đã là số nguyên
                    }

                    if (floor($gt) != $gt) {
                        // Có phần thập phân — KHÔNG tự cắt. Xem chú thích đầu lớp.
                        $oLe[] = sprintf('%s.%s = %s (_id %s)', $bang, $truong, var_export($gt, true), (string) $doc['_id']);
                        continue;
                    }

                    $canDoi[] = $doc['_id'];
                }

                if (!$canDoi) {
                    continue;
                }

                $tongCanDoi += count($canDoi);
                $this->line(sprintf('  %-24s %-18s %d bản ghi', $bang, $truong, count($canDoi)));

                if (!$ghiThat) {
                    continue;
                }

                foreach ($canDoi as $id) {
                    $doc = $coll->findOne(['_id' => $id]);
                    // Int64 thay vì (int): Mongo phân biệt int32/int64, và số tiền lớn
                    // (doanh thu cả kỳ) có thể vượt int32 trên nền 32-bit.
                    $coll->updateOne(['_id' => $id], ['$set' => [$truong => new Int64((int) $doc[$truong])]]);
                    $tongDaDoi++;
                }
            }
        }

        $this->newLine();

        if ($oLe) {
            $this->error(sprintf('%d ô có phần thập phân — KHÔNG đổi, vì cắt đi là làm sai số tiền:', count($oLe)));
            foreach (array_slice($oLe, 0, 20) as $d) {
                $this->line('  ' . $d);
            }
            $this->warn('Hãy tìm chỗ tính tiền sinh ra số lẻ đó rồi chạy lại lệnh này.');
            $this->newLine();
        }

        if ($tongCanDoi === 0) {
            $this->info('Mọi trường tiền đã là số nguyên. Không có gì để làm.');
            return $oLe ? self::FAILURE : self::SUCCESS;
        }

        $this->info($ghiThat
            ? "Đã đổi {$tongDaDoi} ô sang số nguyên."
            : "Có {$tongCanDoi} ô đang là số thực. Chạy lại kèm --apply để đổi.");

        return $oLe ? self::FAILURE : self::SUCCESS;
    }
}
