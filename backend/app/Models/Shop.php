<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Shop extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'shops';
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

    /**
     * Nhân viên làm việc tại quán này (`users.shop_id`).
     *
     * KHÁC HẲN `user()` ở trên — đó là CHỦ quán. Hai quan hệ này trỏ ngược nhau giữa
     * `users` và `shops`, nhưng chúng mang hai nghĩa khác nhau chứ không phải vòng lặp:
     * `shops.user_id` = ai sở hữu, `users.shop_id` = làm việc ở đâu.
     */
    public function staff()
    {
        return $this->hasMany(User::class, 'shop_id');
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class, 'shop_id');
    }

    public function categories()
    {
        return $this->hasMany(Category::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function toppings()
    {
        return $this->hasMany(Topping::class);
    }

    public function tables()
    {
        return $this->hasMany(ShopTable::class);
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
