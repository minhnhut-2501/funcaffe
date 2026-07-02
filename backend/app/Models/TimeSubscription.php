<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class TimeSubscription extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'time_subscriptions';
    protected $fillable = ['package_id', 'duration_value', 'duration_unit', 'price', 'label', 'status'];

    public function package()
    {
        return $this->belongsTo(Package::class);
    }
}
