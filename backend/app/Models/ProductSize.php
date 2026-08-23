<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class ProductSize extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'product_sizes';
    protected $fillable = ['product_id', 'size_name', 'price', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
        'price'     => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
