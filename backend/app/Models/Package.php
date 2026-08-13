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
        // KHÔNG cast 'features' => 'array'. Cast đó json_encode giá trị trước khi
        // ghi, nên trong MongoDB `features` nằm dưới dạng CHUỖI JSON thay vì mảng
        // BSON — đọc qua model vẫn ra mảng nên nhìn ngoài không thấy gì sai, nhưng
        // dữ liệu lệch chuẩn, lệch ERD và không truy vấn được bằng toán tử mảng.
        // Bỏ cast đi thì mongodb-laravel lưu mảng ở dạng native. (Cùng lỗi đã sửa
        // cho `invoices` trước đây.)
        'is_trial' => 'boolean',
        'level' => 'integer',
        'max_tables' => 'integer',
        'max_menu_items' => 'integer',
        'can_use_ai' => 'boolean',
    ];

    /**
     * `features` LUÔN đọc ra mảng, dù trong CSDL nó là mảng hay chuỗi JSON.
     *
     * Vì sao cần: bỏ cast 'array' ở trên là đúng cho dữ liệu MỚI, nhưng những bản ghi
     * đã ghi bằng mã cũ vẫn nằm đó dưới dạng chuỗi `"[\"...\",\"...\"]"`. Đọc thẳng ra
     * là trả chuỗi đó cho giao diện, và `features.map(...)` nổ — trang Bảng giá công
     * khai trắng trơn. Đúng chuyện đã xảy ra trên bản triển khai: CSDL gieo bằng mã cũ,
     * máy chủ chạy mã mới.
     *
     * Đổi cấu trúc dữ liệu mà quên rằng dữ liệu cũ vẫn còn nguyên là một cách rất dễ
     * làm hỏng bản đã chạy, trong khi máy phát triển thì không thấy gì. Chốt chặn đặt
     * ở đây để mã KHÔNG phụ thuộc vào việc ai đó nhớ chạy lệnh dọn dữ liệu.
     *
     * Dọn dữ liệu về đúng dạng: `php artisan db:fix-package-features`.
     */
    public function getFeaturesAttribute($value): array
    {
        if (is_string($value)) {
            $giaiMa = json_decode($value, true);
            return is_array($giaiMa) ? $giaiMa : array_filter([$value]);
        }

        return is_array($value) ? array_values($value) : [];
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function timeSubscriptions()
    {
        return $this->hasMany(TimeSubscription::class);
    }
}
