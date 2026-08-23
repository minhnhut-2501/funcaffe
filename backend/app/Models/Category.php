<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Category extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'categories';
    protected $fillable = ['shop_id', 'name', 'description', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
