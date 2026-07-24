<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Cafe extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'cafes';
    protected $fillable = [
        'user_id', 'name', 'address', 'phone', 'description', 'status', 'logo',
        // Tài khoản ngân hàng nhận tiền (VietQR) cho luồng khách trả tiền cho chủ quán
        'bank_bin', 'bank_account_number', 'bank_account_name',
        // Đa quán: mỗi quán được dùng thử Fun Free 1 lần (trial theo QUÁN, không theo tài khoản)
        'has_used_free_trial',
    ];

    protected $casts = [
        'has_used_free_trial' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class, 'cafe_id');
    }

    public function categories()
    {
        return $this->hasMany(Category::class);
    }

    public function items()
    {
        return $this->hasMany(Item::class);
    }

    public function toppings()
    {
        return $this->hasMany(Topping::class);
    }

    public function tables()
    {
        return $this->hasMany(CafeTable::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }
}
