<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class ItemTopping extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'item_toppings';
    protected $fillable = ['item_id', 'topping_id'];

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function topping()
    {
        return $this->belongsTo(Topping::class);
    }
}
