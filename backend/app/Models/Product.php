<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Product extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'products';
    protected $fillable = ['shop_id', 'category_id', 'name', 'base_price', 'has_size', 'has_topping', 'is_available', 'image', 'description', 'display_order'];

    protected $casts = [
        'has_size' => 'boolean',
        'has_topping' => 'boolean',
        'is_available' => 'boolean',
        'base_price' => 'integer',
    ];

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function productSizes()
    {
        return $this->hasMany(ProductSize::class);
    }

    public function productToppings()
    {
        return $this->hasMany(ProductTopping::class);
    }
}
