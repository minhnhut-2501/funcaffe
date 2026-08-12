<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Topping extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'toppings';
    protected $fillable = ['cafe_id', 'name', 'price', 'is_available', 'image'];

    protected $casts = [
        'is_available' => 'boolean',
        // Số NGUYÊN như base_price của Item và price của ItemPrice. Trước đây là
        // 'float', nên topping là chỗ duy nhất trong thực đơn trả về số thực: giá
        // đó được nhân với số phần rồi nhân với số ly ở OrderController, và hóa đơn
        // ra số lẻ mà không ai gõ vào. Tiền Việt không có đơn vị nhỏ hơn đồng.
        'price' => 'integer',
    ];

    public function cafe()
    {
        return $this->belongsTo(Cafe::class);
    }

    public function itemToppings()
    {
        return $this->hasMany(ItemTopping::class);
    }
}
