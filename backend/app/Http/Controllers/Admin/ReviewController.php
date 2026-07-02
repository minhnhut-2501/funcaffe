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
        $reviews = Review::with('user', 'cafe', 'package')
            ->get()
            ->map(function ($review) {
                $data = $review->toArray();
                $data['user_name'] = $review->user?->full_name ?? '';
                $data['cafe_name'] = $review->cafe?->name ?? '';
                $data['package_name'] = $review->package?->name ?? '';
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
