<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class ContactMessage extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'contact_messages';
    protected $fillable = [
        'full_name', 'email', 'phone', 'cafe_name', 'content', 'is_read',
        // Trả lời của admin (gửi qua email). Mongo không có schema cố định nên
        // các bản ghi cũ đơn giản là không có mấy trường này — không cần migration.
        'reply', 'replied_at', 'replied_by',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'replied_at' => 'datetime',
    ];
}
