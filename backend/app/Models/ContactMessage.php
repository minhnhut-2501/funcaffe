<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class ContactMessage extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'contact_messages';
    protected $fillable = ['full_name', 'email', 'phone', 'cafe_name', 'content', 'is_read'];
}
