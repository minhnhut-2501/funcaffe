<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * Seeder cho môi trường production (Render free — không có Shell để chạy tay).
 * Chạy tự động lúc container khởi động (xem Dockerfile CMD).
 *
 * KHÁC với DatabaseSeeder (import demo, DROP collection): seeder này
 * IDEMPOTENT + KHÔNG XÓA — chỉ nạp `packages`/`time_subscriptions` khi
 * collection còn RỖNG, nên chạy lại mỗi lần restart/ngủ dậy đều an toàn,
 * không đụng dữ liệu người dùng đã tạo.
 */
class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedIfEmpty('packages', __DIR__ . '/data/packages.json');
        $this->seedIfEmpty('time_subscriptions', __DIR__ . '/data/time_subscriptions.json');

        // Tài khoản admin + chủ quán (đã idempotent sẵn: chỉ tạo nếu chưa có).
        // Tạo trước để _id chủ quán khớp user_id của quán demo bên dưới.
        $this->call(TestUserSeeder::class);

        // Dữ liệu demo cho chủ quán nphec4007@gmail.com: quán + thực đơn + bàn.
        foreach (['cafes', 'categories', 'items', 'item_prices', 'toppings', 'item_toppings', 'tables'] as $col) {
            $this->seedIfEmpty($col, __DIR__ . "/data/{$col}.json");
        }
    }

    private function seedIfEmpty(string $collection, string $file): void
    {
        $mongo = DB::connection('mongodb')->getMongoDB();

        if ($mongo->selectCollection($collection)->countDocuments() > 0) {
            $this->command->info("Skip {$collection}: đã có dữ liệu");
            return;
        }

        if (!File::exists($file)) {
            $this->command->warn("Bỏ qua {$collection}: không thấy {$file}");
            return;
        }

        $data = json_decode(File::get($file), true);
        if (empty($data)) {
            return;
        }

        $clean = array_map(fn ($doc) => $this->convertDocument($doc), $data);
        $mongo->selectCollection($collection)->insertMany($clean);

        $this->command->info("Seeded {$collection}: " . count($clean) . " documents");
    }

    /** Chuyển extended-JSON ($oid/$date/$number...) sang kiểu BSON của MongoDB. */
    private function convertDocument(array $doc): array
    {
        $result = [];

        foreach ($doc as $key => $value) {
            if ($key === '_id' && is_array($value) && isset($value['$oid'])) {
                $result['_id'] = new \MongoDB\BSON\ObjectId($value['$oid']);
                continue;
            }

            if (is_array($value)) {
                if (isset($value['$oid'])) {
                    $result[$key] = new \MongoDB\BSON\ObjectId($value['$oid']);
                } elseif (isset($value['$date'])) {
                    $result[$key] = new \MongoDB\BSON\UTCDateTime(strtotime($value['$date']) * 1000);
                } elseif (isset($value['$numberDecimal'])) {
                    $result[$key] = (float) $value['$numberDecimal'];
                } elseif (isset($value['$numberInt'])) {
                    $result[$key] = (int) $value['$numberInt'];
                } elseif (isset($value['$numberLong'])) {
                    $result[$key] = (int) $value['$numberLong'];
                } else {
                    $result[$key] = $this->convertDocument($value);
                }
            } else {
                $result[$key] = $value;
            }
        }

        return $result;
    }
}
