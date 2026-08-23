<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Order extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'orders';
    protected $fillable = ['shop_id', 'table_id', 'code', 'status', 'note', 'subtotal', 'discount_amount', 'total_amount', 'paid_at',
        // Thanh toán gộp thẳng vào order (bỏ bảng invoices): mã phiếu + phương thức +
        // trạng thái thanh toán + tiền mặt/thối.
        'invoice_code', 'payment_method', 'payment_status', 'cash_received', 'change_amount',
        // Bán tại quán ('dine_in') hay mang về ('takeaway'). Đơn mang về KHÔNG có
        // table_id — quán hết bàn vẫn bán được, đó là lý do trường này ra đời.
        'order_type',
        // Ai mở đơn / ai thu tiền. Dùng để in dòng "Thu ngân" lên hóa đơn và để đối
        // ca khi quán có nhiều nhân viên.
        'created_by', 'paid_by',
        // Mã giao dịch cổng thanh toán, để callback tra ngược về đúng đơn. Chỉ có ở
        // đơn trả qua cổng, không có ở đơn tiền mặt.
        'gateway_txn_ref'];

    /**
     * MỌI trường tiền là SỐ NGUYÊN. Đồng Việt Nam không có đơn vị nhỏ hơn đồng, nên
     * số thực ở đây chỉ mang lại rắc rối: hóa đơn hiện số lẻ mà không ai gõ vào, và
     * phép cộng nhiều dòng tích lũy sai số nhị phân (0.1 + 0.2 ≠ 0.3).
     *
     * Trước đây `subtotal`, `discount_amount`, `total_amount` ép kiểu 'float' trong
     * khi `cash_received`, `change_amount` đã là 'integer', và `Product::base_price`
     * cũng vậy — cùng một đồng tiền mà hai kiểu khác nhau tùy chỗ đọc.
     *
     * Lưu ý cho người sửa sau: cast 'integer' của Laravel CẮT phần thập phân chứ
     * không làm tròn. Nơi tính tiền phải `round()` trước khi ghi, đừng dựa vào cast.
     */
    protected $casts = [
        'subtotal' => 'integer',
        'discount_amount' => 'integer',
        'total_amount' => 'integer',
        'cash_received' => 'integer',
        'change_amount' => 'integer',
    ];

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function table()
    {
        return $this->belongsTo(ShopTable::class);
    }

    public function orderDetails()
    {
        return $this->hasMany(OrderDetail::class);
    }
}
