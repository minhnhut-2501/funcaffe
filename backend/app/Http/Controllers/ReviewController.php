<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use App\Models\Review;
use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    use ChecksCafeOwnership;

    public function __construct()
    {
        $this->middleware('auth:sanctum')->except(['publicReviews']);
    }

    public function publicReviews()
    {
        $reviews = Review::where('status', 'visible')
            ->with('user', 'cafe', 'package')
            ->orderBy('created_at', 'desc')
            ->limit(12)
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

    public function index(Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $reviews = Review::where('cafe_id', $cafe->id)
            ->with('user', 'package')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($review) {
                $data = $review->toArray();
                $data['user_name'] = $review->user?->full_name ?? '';
                $data['package_name'] = $review->package?->name ?? '';
                return $data;
            });

        return response()->json($reviews);
    }

    public function store(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $validated = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'title' => 'nullable|string|max:255',
            'comment' => 'nullable|string|max:2000',
        ]);

        $user = $request->user();
        $package = $user->subscriptions()->where('status', 'active')->first();

        $review = Review::create(array_merge($validated, [
            'user_id' => (string) $user->id,
            'cafe_id' => (string) $cafe->id,
            'package_id' => $package ? (string) $package->package_id : null,
            'status' => 'visible',
        ]));

        $data = $review->toArray();
        $data['user_name'] = $user->full_name;
        $data['package_name'] = $package?->package_name_snapshot ?? '';

        return response()->json($data, 201);
    }
}
