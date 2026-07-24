<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class PackagePayment extends Model
{
    /**
     * Các cổng thanh toán ONLINE tự xác nhận: kích hoạt tự động khi khách trả đủ tiền,
     * KHÔNG cần admin duyệt tay. Thêm cổng mới (vd MoMo) chỉ cần bổ sung vào đây.
     */
    public const ONLINE_GATEWAYS = ['vnpay', 'momo'];

    protected $connection = 'mongodb';
    protected $collection = 'package_payments';
    protected $fillable = [
        'user_id', 'cafe_id', 'package_id', 'time_subscription_id', 'subscription_id',
        // subtotal = giá gói chưa VAT; amount = số tiền thực trả (đã gồm VAT)
        'subtotal', 'vat_rate', 'vat_amount',
        'amount', 'payment_method', 'payment_status', 'transaction_code',
        'note', 'paid_at',
        'action_type', 'previous_subscription_id', 'previous_end_date',
        // Nâng cấp giữa kỳ: giá trị còn lại của gói cũ được CẤN TRỪ THẲNG vào giá gói mới
        // (khách chỉ trả phần chênh lệch). Đây KHÔNG phải hoàn tiền mặt — không có luồng
        // admin duyệt, nên chỉ có 2 trạng thái.
        // credit_status: none | applied
        'credit_amount', 'credit_status',
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

    public function cafe()
    {
        return $this->belongsTo(Cafe::class, 'cafe_id');
    }
}
