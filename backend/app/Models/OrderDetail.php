<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class OrderDetail extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'order_details';
    protected $fillable = ['order_id', 'product_id', 'product_name_snapshot', 'product_size_id', 'size_name_snapshot', 'quantity', 'unit_price', 'subtotal', 'topping_total', 'total_price', 'note'];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'integer',
        'subtotal' => 'integer',
        'topping_total' => 'integer',
        'total_price' => 'integer',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function productSize()
    {
        return $this->belongsTo(ProductSize::class);
    }

    public function orderDetailToppings()
    {
        return $this->hasMany(OrderDetailTopping::class);
    }
}
