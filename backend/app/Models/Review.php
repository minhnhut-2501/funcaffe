<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Review extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'reviews';
    protected $fillable = [
        'user_id', 'cafe_id', 'package_id',
        'rating', 'title', 'comment',
        'status',
        // Các bản đánh giá cũ của chính chủ quán này. Mỗi chủ quán chỉ có MỘT
        // đánh giá hiện hành (gửi lại là ghi đè), nên bản cũ được đẩy vào đây
        // trước khi bị thay — xem ReviewController@store.
        // KHÔNG khai cast 'array' cho history: trong laravel-mongodb, cast này
        // ghi xuống dưới dạng chuỗi JSON thay vì mảng BSON gốc (và đã bị đánh
        // dấu deprecated). Để trần thì Mongo lưu đúng mảng lồng document.
        'history',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function cafe()
    {
        return $this->belongsTo(Cafe::class);
    }

    public function package()
    {
        return $this->belongsTo(Package::class);
    }
}
