<?php

namespace App\Http\Controllers;

use App\Models\ContactMessage;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'full_name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => 'nullable|string|max:20',
            'cafe_name' => 'nullable|string|max:255',
            'content' => 'required|string|max:2000',
        ]);

        $message = ContactMessage::create($validated + ['is_read' => false]);

        return response()->json(['message' => 'Tin nhắn của bạn đã được gửi. Chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.'], 201);
    }
}
