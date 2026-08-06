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
        // KHÔNG có user_id: chủ sở hữu suy từ cafe_id -> cafes.user_id. Mọi truy vấn
        // gói đều lọc theo cafe_id, nên bản sao user_id ở đây chỉ tạo thêm một nguồn
        // sự thật thứ hai mà không ai đọc.
        'cafe_id', 'package_id', 'time_subscription_id',
        'package_name_snapshot',
        'start_date', 'end_date', 'status',
        'total_amount',
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

    /**
     * Scope "gói MỚI NHẤT của một quán" — kể cả khi đã quá hạn.
     *
     * Khác hẳn effective() và đừng lẫn hai cái:
     *  - effective()    : dùng khi hỏi "được PHÉP làm gì" (ghi dữ liệu, dùng AI, giới
     *                     hạn số bàn/món). Gói hết hạn phải bị loại.
     *  - latestForCafe(): dùng khi hỏi "quán này ĐANG Ở TÌNH TRẠNG NÀO" (hiện tên gói,
     *                     cảnh báo sắp hết / đã hết hạn, mời gia hạn). Gói hết hạn mới
     *                     chính là thứ cần hiện, loại nó đi thì không cảnh báo được ai.
     *
     * "Mới nhất" tính theo end_date chứ KHÔNG theo created_at: gói còn hạn luôn phải
     * thắng gói đã hết, kể cả khi bản ghi của nó được tạo trước. Không có tác vụ nào
     * đổi status sang 'expired' nên một quán có thể có nhiều bản ghi cùng 'active'.
     *
     * Trước đây khái niệm này được cài lại bằng tay ở bốn nơi với ba cách sắp xếp khác
     * nhau (sort giảm dần lấy đầu / sort tăng dần + keyBy lấy cuối / latest() theo
     * created_at). Gom về đây để chúng không lệch nhau ở lần sửa tiếp theo.
     */
    public function scopeLatestForCafe($query, string $cafeId)
    {
        return $query->where('cafe_id', $cafeId)
            ->where('status', 'active')
            ->orderBy('end_date', 'desc');
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
