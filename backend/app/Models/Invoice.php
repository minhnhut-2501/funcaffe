<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Invoice extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'invoices';
    protected $fillable = ['order_id', 'cafe_id', 'table_id', 'invoice_code', 'cafe_snapshot', 'table_snapshot', 'items', 'subtotal', 'discount_amount', 'total_amount', 'payment_method', 'payment_status', 'paid_at'];

    // LƯU Ý: KHÔNG cast 'array' cho cafe_snapshot/table_snapshot/items.
    // Cast 'array' của Laravel json_encode -> lưu CHUỖI trong DB; với MongoDB ta muốn
    // lưu object/array NATIVE (query được, khớp ERD). Không cast = mongodb-laravel lưu BSON native.
    protected $casts = [
        'subtotal' => 'integer',
        'discount_amount' => 'integer',
        'tax_amount' => 'integer',
        'total_amount' => 'integer',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function cafe()
    {
        return $this->belongsTo(Cafe::class, 'cafe_id');
    }
}
