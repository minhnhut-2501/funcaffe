<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Subscription extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'subscriptions';
    protected $fillable = [
        'user_id', 'package_id', 'time_subscription_id',
        'package_name_snapshot',
        'start_date', 'end_date', 'status', 'subtotal', 'total_amount',
        'action_type', 'previous_subscription_id', 'is_pending_review',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function package()
    {
        return $this->belongsTo(Package::class);
    }

    public function packagePayments()
    {
        return $this->hasMany(PackagePayment::class);
    }
}
