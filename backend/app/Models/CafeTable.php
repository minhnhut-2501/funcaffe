<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class CafeTable extends Model
{
    protected $connection = 'mongodb';
    // LƯU Ý: mongodb/laravel-mongodb v5 KHÔNG đọc $collection -> phải dùng $table (chuẩn Eloquent).
    // Nếu để mặc định, tên class CafeTable map nhầm sang collection 'cafe_tables'.
    protected $table = 'tables';
    protected $fillable = ['cafe_id', 'name', 'capacity', 'status', 'current_order_id', 'display_order'];

    public function cafe()
    {
        return $this->belongsTo(Cafe::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
