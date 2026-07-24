<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Seeder gốc — `php artisan db:seed` chạy class này.
 *
 * Toàn bộ dữ liệu khởi tạo nằm ở ProductionSeeder (idempotent, KHÔNG xóa dữ liệu
 * người dùng, đọc JSON trong seeders/data/). Ở đây chỉ ủy quyền sang đó để
 * `db:seed`, `migrate --seed` và `migrate:fresh --seed` đều ra cùng một kết quả.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(ProductionSeeder::class);
    }
}
