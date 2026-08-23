<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class ShopTable extends Model
{
    protected $connection = 'mongodb';
    // LƯU Ý: mongodb/laravel-mongodb v5 KHÔNG đọc $collection -> phải dùng $table (chuẩn Eloquent).
    // Nếu để mặc định, tên class ShopTable map nhầm sang collection 'shop_tables'.
    protected $table = 'tables';
    protected $fillable = ['shop_id', 'name', 'capacity', 'status', 'current_order_id', 'display_order', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * `is_active` THAY CHO việc xóa bàn.
     *
     * Xóa một cái bàn là bỏ rơi mọi hóa đơn cũ từng gắn với nó: `orders.table_id` trỏ
     * vào một document không còn tồn tại, và bảng Hóa đơn hiện cột Bàn trống trơn cho
     * những đơn đã bán xong từ đời nào. Cùng lý do với danh mục, món, topping và quán
     * — chỗ nào cũng chỉ ẩn chứ không xóa.
     *
     * Bàn ẩn KHÔNG hiện ở màn Bán hàng nhưng vẫn tính vào hạn mức gói, giống hệt cách
     * món ẩn đang được tính (xem ProductController@store).
     */
    public function scopeConDung($query)
    {
        // Dữ liệu cũ chưa có trường này thì coi như còn dùng — không được để bàn đang
        // hoạt động biến mất khỏi màn Bán hàng chỉ vì migration chưa chạy.
        return $query->where('is_active', '!=', false);
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
