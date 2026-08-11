<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Package extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'packages';
    protected $fillable = [
        'name', 'type',
        'is_trial', 'description',
        'features', 'status', 'level',
        'max_tables', 'max_menu_items', 'can_use_ai',
    ];

    protected $casts = [
        // KHÔNG cast 'features' => 'array'. Cast đó json_encode giá trị trước khi
        // ghi, nên trong MongoDB `features` nằm dưới dạng CHUỖI JSON thay vì mảng
        // BSON — đọc qua model vẫn ra mảng nên nhìn ngoài không thấy gì sai, nhưng
        // dữ liệu lệch chuẩn, lệch ERD và không truy vấn được bằng toán tử mảng.
        // Bỏ cast đi thì mongodb-laravel lưu mảng ở dạng native. (Cùng lỗi đã sửa
        // cho `invoices` trước đây.)
        'is_trial' => 'boolean',
        'level' => 'integer',
        'max_tables' => 'integer',
        'max_menu_items' => 'integer',
        'can_use_ai' => 'boolean',
    ];

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function timeSubscriptions()
    {
        return $this->hasMany(TimeSubscription::class);
    }
}
