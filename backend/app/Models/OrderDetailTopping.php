<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class OrderDetailTopping extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'order_detail_toppings';
    protected $fillable = ['order_detail_id', 'topping_id', 'topping_name_snapshot', 'quantity', 'price_at_time', 'subtotal'];

    protected $casts = [
        'quantity' => 'integer',
        'price_at_time' => 'float',
        'subtotal' => 'float',
    ];

    public function orderDetail()
    {
        return $this->belongsTo(OrderDetail::class);
    }

    public function topping()
    {
        return $this->belongsTo(Topping::class);
    }
}
