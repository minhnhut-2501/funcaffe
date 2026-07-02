<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Support\Facades\DB;

/**
 * #3: Đảm bảo tính toàn vẹn cho các thao tác ghi nhiều bước (tạo order +
 * cập nhật bàn, tạo subscription + payment, thanh toán + tạo hóa đơn...).
 *
 * MongoDB transaction chỉ chạy trên replica set. Vì vậy ta bọc logic trong
 * một transaction KHI cấu hình 'database.mongodb_transactions' = true,
 * ngược lại (Mongo standalone) thì chạy trực tiếp để không gây lỗi.
 */
trait RunsAtomically
{
    protected function atomic(callable $callback)
    {
        if (config('database.mongodb_transactions', false)) {
            return DB::connection('mongodb')->transaction($callback);
        }

        return $callback();
    }
}
