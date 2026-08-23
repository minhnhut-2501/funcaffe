<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class ShopTable extends Model
{
    protected $connection = 'mongodb';
    // LƯU Ý: mongodb/laravel-mongodb v5 KHÔNG đọc $collection -> phải dùng $table (chuẩn Eloquent).
    // Nếu để mặc định, tên class ShopTable map nhầm sang collection 'shop_tables'.
    protected $table = 'tables';
    protected $fillable = ['shop_id', 'name', 'capacity', 'status', 'current_order_id', 'display_order'];

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
