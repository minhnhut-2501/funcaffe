<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class ProductTopping extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'product_toppings';
    protected $fillable = ['product_id', 'topping_id'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function topping()
    {
        return $this->belongsTo(Topping::class);
    }
}
