<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Subscription extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'subscriptions';
    /**
     * Collection này là TRẠNG THÁI QUYỀN DÙNG (ai / quán nào / gói nào / từ ngày -> đến ngày),
     * KHÔNG phải chứng từ tài chính. Mọi thông tin tiền bạc chi tiết (subtotal, VAT, phương
     * thức, mã giao dịch, lịch sử từng lần trả) là của `package_payments` — quan hệ 1:N vì
     * gia hạn tái sử dụng chính subscription này và chỉ thêm payment mới.
     *
     * Ngoại lệ duy nhất là `total_amount`: TỔNG tiền đã trả cho chu kỳ hiện hành
     * (start_date -> end_date), giữ lại vì calculateProratedCredit() cần chia nó theo thời
     * gian còn lại. Nó PHẢI được cập nhật đúng theo cặp với `end_date` ở mọi nhánh gia hạn.
     */
    protected $fillable = [
        'user_id', 'cafe_id', 'package_id', 'time_subscription_id',
        'package_name_snapshot',
        'start_date', 'end_date', 'status',
        'total_amount',
        'is_pending_review',
    ];

    /**
     * Scope "gói CÒN HIỆU LỰC" = status active VÀ chưa qua end_date.
     * Dùng chung để mọi nơi nhận diện hết hạn giống nhau (khớp middleware
     * CheckSubscription). Lưu ý: không có job đổi status sang 'expired' —
     * gói hết hạn vẫn giữ status 'active', nên PHẢI kiểm end_date.
     */
    public function scopeEffective($query)
    {
        return $query->where('status', 'active')->where('end_date', '>', now());
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function cafe()
    {
        return $this->belongsTo(Cafe::class, 'cafe_id');
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
