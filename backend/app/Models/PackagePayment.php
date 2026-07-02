<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class PackagePayment extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'package_payments';
    protected $fillable = [
        'user_id', 'package_id', 'time_subscription_id', 'subscription_id',
        'amount', 'payment_method', 'payment_status', 'transaction_code',
        'note', 'paid_at',
        'action_type', 'previous_subscription_id', 'previous_end_date',
        // #4: Hoàn tiền phần thời gian còn lại của gói cũ khi nâng cấp.
        // refund_status: none | pending | approved | rejected
        'refund_amount', 'refund_status', 'refund_note', 'refunded_at',
        // Thông tin từ cổng thanh toán online (VNPay)
        'gateway_txn_no', 'gateway_bank_code',
    ];

    public function subscription()
    {
        return $this->belongsTo(Subscription::class);
    }

    public function package()
    {
        return $this->belongsTo(Package::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
