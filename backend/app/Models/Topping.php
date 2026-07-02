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
        'price' => 'float',
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
