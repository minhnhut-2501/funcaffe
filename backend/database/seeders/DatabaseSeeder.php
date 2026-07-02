<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $jsonPath = __DIR__ . '/../../../aPlan/json';

        $collections = [
            'packages',
            'sizes',
            'users',
            'cafes',
            'categories',
            'items',
            'item_prices',
            'toppings',
            'item_toppings',
            'tables',
            'orders',
            'order_details',
            'order_detail_toppings',
            'invoices',
            'subscriptions',
            'package_payments',
        ];

        $mongo = \Illuminate\Support\Facades\DB::connection('mongodb')->getMongoDB();

        foreach ($collections as $col) {
            $file = "{$jsonPath}/{$col}.json";
            if (!File::exists($file)) {
                $this->command->warn("Skipping {$col}.json (not found)");
                continue;
            }

            $data = json_decode(File::get($file), true);
            if (empty($data)) {
                $this->command->warn("Skipping {$col}.json (empty)");
                continue;
            }

            $cleanData = array_map(function ($doc) {
                return $this->convertDocument($doc);
            }, $data);

            try {
                $mongo->dropCollection($col);
            } catch (\Exception $e) {
                // Collection may not exist, ignore
            }
            $mongo->selectCollection($col)->insertMany($cleanData);

            $this->command->info("Seeded {$col}: " . count($cleanData) . " documents");
        }

        $this->call(TestUserSeeder::class);
    }

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
