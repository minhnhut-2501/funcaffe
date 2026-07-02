<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Size extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'sizes';
    protected $fillable = ['name', 'description', 'sort_order', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function itemPrices()
    {
        return $this->hasMany(ItemPrice::class);
    }
}
