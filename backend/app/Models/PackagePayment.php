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
        // (khách chỉ trả phần chênh lệch, lưu như một dòng biên lai). Đây KHÔNG phải hoàn
        // tiền mặt; đã "applied" hay chưa suy trực tiếp từ credit_amount > 0.
        'credit_amount',
        // Thông tin từ cổng thanh toán online (VNPay/MoMo)
        'gateway_txn_no', 'gateway_bank_code',
        /*
         * Mã đơn ĐÃ GỬI SANG CỔNG, khi nó khác transaction_code.
         *
         * Cần cho MoMo: MoMo bắt mã đơn duy nhất theo partner code, mà partner code
         * của môi trường thử nghiệm là dùng chung. Trong khi đó transaction_code lại
         * được sinh bằng cách đếm giao dịch TRONG CHÍNH CSDL này, nên máy local và
         * máy production đều đẻ ra 'TXN-<ngày>-0001' cho giao dịch đầu tiên trong
         * ngày — gửi cái thứ hai sang là MoMo từ chối vì trùng.
         *
         * Vì vậy gửi đi kèm đuôi ngẫu nhiên và lưu lại đây để callback tra đúng đơn.
         * transaction_code giữ nguyên định dạng cũ cho hóa đơn và trang quản trị.
         */
        'gateway_order_id',
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
