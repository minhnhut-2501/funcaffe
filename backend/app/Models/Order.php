<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Order extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'orders';
    protected $fillable = ['cafe_id', 'table_id', 'code', 'status', 'note', 'subtotal', 'discount_amount', 'total_amount', 'paid_at',
        // Thanh toán gộp thẳng vào order (bỏ bảng invoices): mã phiếu + phương thức +
        // trạng thái thanh toán (paid/refunded) + tiền mặt/thối + thông tin hoàn tiền.
        'invoice_code', 'payment_method', 'payment_status', 'cash_received', 'change_amount', 'refunded_at', 'refund_reason'];

    protected $casts = [
        'subtotal' => 'float',
        'discount_amount' => 'float',
        'total_amount' => 'float',
        'cash_received' => 'integer',
        'change_amount' => 'integer',
    ];

    public function cafe()
    {
        return $this->belongsTo(Cafe::class);
    }

    public function table()
    {
        return $this->belongsTo(CafeTable::class);
    }

    public function orderDetails()
    {
        return $this->hasMany(OrderDetail::class);
    }
}
