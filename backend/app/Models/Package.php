<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Package extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'packages';
    protected $fillable = [
        'name', 'type',
        'is_trial', 'description',
        'features', 'status', 'level',
        'max_tables', 'max_menu_items', 'can_use_ai',
    ];

    protected $casts = [
        'features' => 'array',
        'is_trial' => 'boolean',
        'level' => 'integer',
        'max_tables' => 'integer',
        'max_menu_items' => 'integer',
        'can_use_ai' => 'boolean',
    ];

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function timeSubscriptions()
    {
        return $this->hasMany(TimeSubscription::class);
    }
}
