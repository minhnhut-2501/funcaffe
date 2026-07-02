<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class OrderDetail extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'order_details';
    protected $fillable = ['order_id', 'item_id', 'item_name_snapshot', 'item_price_id', 'size_name_snapshot', 'quantity', 'unit_price', 'subtotal', 'topping_total', 'total_price', 'note'];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'float',
        'subtotal' => 'float',
        'topping_total' => 'float',
        'total_price' => 'float',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function itemPrice()
    {
        return $this->belongsTo(ItemPrice::class);
    }

    public function orderDetailToppings()
    {
        return $this->hasMany(OrderDetailTopping::class);
    }
}
