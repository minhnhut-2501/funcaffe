<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Item extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'items';
    protected $fillable = ['cafe_id', 'category_id', 'name', 'base_price', 'has_size', 'allow_topping', 'is_available', 'image', 'description', 'display_order'];

    protected $casts = [
        'has_size' => 'boolean',
        'allow_topping' => 'boolean',
        'is_available' => 'boolean',
        'base_price' => 'integer',
    ];

    public function cafe()
    {
        return $this->belongsTo(Cafe::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function itemPrices()
    {
        return $this->hasMany(ItemPrice::class);
    }

    public function itemToppings()
    {
        return $this->hasMany(ItemTopping::class);
    }
}
