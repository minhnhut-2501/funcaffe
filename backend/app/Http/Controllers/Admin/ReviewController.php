<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Review;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'admin']);
    }

    public function index()
    {
        $reviews = Review::with('user', 'shop', 'package')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($review) {
                $data = $review->toArray();
                // Không trả nguyên object quan hệ: user chứa email, phone,
                // remember_token... Admin chỉ cần tên để hiển thị.
                unset($data['user'], $data['shop'], $data['package']);
                $data['user_name'] = $review->user?->full_name ?? '';
                $data['user_email'] = $review->user?->email ?? '';
                $data['shop_name'] = $review->shop?->name ?? '';
                $data['package_name'] = $review->package?->name ?? '';
                // Các bản đánh giá cũ, mới nhất lên đầu cho dễ đọc trong chi tiết.
                $data['history'] = array_reverse((array) ($review->history ?? []));
                return $data;
            });

        return response()->json($reviews);
    }

    public function toggleStatus(Review $review)
    {
        $review->status = $review->status === 'visible' ? 'hidden' : 'visible';
        $review->save();
        return response()->json($review);
    }
}
