<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class ItemPrice extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'item_prices';
    protected $fillable = ['item_id', 'size_name', 'price', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
        'price'     => 'integer',
    ];

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
