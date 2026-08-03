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
                // SECURITY: chỉ trả field cần cho hiển thị public — TUYỆT ĐỐI không
                // nhúng nguyên object user/cafe (lộ email, phone, reset_token...).
                return [
                    'id'           => (string) $review->_id,
                    'rating'       => $review->rating,
                    'title'        => $review->title,
                    'comment'      => $review->comment,
                    'created_at'   => $review->created_at,
                    'user_name'    => $review->user?->full_name ?? '',
                    'cafe_name'    => $review->cafe?->name ?? '',
                    'package_name' => $review->package?->name ?? '',
                ];
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
                // Không nhúng nguyên object user/package vào response
                unset($data['user'], $data['package']);
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
        // ĐA QUÁN: snapshot gói lấy theo gói active CỦA QUÁN đang đánh giá.
        $package = \App\Models\Subscription::where('cafe_id', (string) $cafe->id)
            ->where('status', 'active')
            ->first();

        // UPSERT: mỗi chủ quán chỉ có 1 đánh giá — gửi lại thì cập nhật đánh giá cũ
        // (giữ trạng thái hiển thị do admin quyết định nếu đã bị ẩn).
        $existing = Review::where('user_id', (string) $user->id)
            ->where('cafe_id', (string) $cafe->id)
            ->first();

        if ($existing) {
            $history = (array) ($existing->history ?? []);

            // Chỉ lưu bản cũ khi nội dung THỰC SỰ đổi — bấm "Cập nhật" mà không
            // sửa gì thì không sinh ra một mốc lịch sử rỗng nghĩa.
            $changed = (int) $existing->rating !== (int) $validated['rating']
                || ($existing->title ?? '') !== ($validated['title'] ?? '')
                || ($existing->comment ?? '') !== ($validated['comment'] ?? '');

            if ($changed) {
                $history[] = [
                    'rating'      => (int) $existing->rating,
                    'title'       => $existing->title,
                    'comment'     => $existing->comment,
                    'package_id'  => $existing->package_id,
                    // Thời điểm bản này được viết, và thời điểm nó bị thay thế.
                    'written_at'  => optional($existing->updated_at ?? $existing->created_at)->toIso8601String(),
                    'replaced_at' => now()->toIso8601String(),
                ];
                // Giữ 20 bản gần nhất: đủ để đối chiếu mà document không phình vô hạn.
                $history = array_slice($history, -20);
            }

            $existing->update(array_merge($validated, [
                'package_id' => $package ? (string) $package->package_id : $existing->package_id,
                'history'    => $history,
            ]));
            $review = $existing->fresh();
            $statusCode = 200;
        } else {
            $review = Review::create(array_merge($validated, [
                'user_id' => (string) $user->id,
                'cafe_id' => (string) $cafe->id,
                'package_id' => $package ? (string) $package->package_id : null,
                'status' => 'visible',
            ]));
            $statusCode = 201;
        }

        $data = $review->toArray();
        $data['user_name'] = $user->full_name;
        $data['package_name'] = $package?->package_name_snapshot ?? '';

        return response()->json($data, $statusCode);
    }
}
