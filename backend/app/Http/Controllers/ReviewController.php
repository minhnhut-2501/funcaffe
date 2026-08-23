<?php

namespace App\Http\Controllers;

use App\Models\Shop;
use App\Models\Review;
use App\Http\Controllers\Concerns\ChecksShopAccess;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    use ChecksShopAccess;

    public function __construct()
    {
        $this->middleware('auth:sanctum')->except(['publicReviews']);
    }

    public function publicReviews()
    {
        // Xếp theo LẦN SỬA gần nhất, không theo ngày viết. Gửi lại là ghi đè bản cũ nên
        // `created_at` đứng yên: xếp theo nó thì chủ quán sửa đánh giá xong vẫn thấy nó
        // nằm nguyên chỗ cũ, và khi đã quá 12 đánh giá thì bản vừa sửa còn không lọt vào
        // danh sách — đúng cái cảm giác "sửa xong mà không thấy gì đổi".
        $reviews = Review::where('status', 'visible')
            ->with('user', 'shop', 'package')
            ->orderBy('updated_at', 'desc')
            ->limit(12)
            ->get()
            ->map(function ($review) {
                // SECURITY: chỉ trả field cần cho hiển thị public — TUYỆT ĐỐI không
                // nhúng nguyên object user/shop (lộ email, phone, reset_token...).
                return [
                    'id'           => (string) $review->_id,
                    'rating'       => $review->rating,
                    'title'        => $review->title,
                    'comment'      => $review->comment,
                    'created_at'   => $review->created_at,
                    'user_name'    => $review->user?->full_name ?? '',
                    // Ảnh đại diện do chính chủ quán tải lên. Người viết đã biết đánh giá
                    // này công khai kèm tên và tên quán, nên avatar cùng mức công khai.
                    // Chưa tải ảnh -> null, frontend rơi về avatar chữ cái.
                    'avatar'       => $review->user?->avatar ?: null,
                    'shop_name'    => $review->shop?->name ?? '',
                    'package_name' => $review->package?->name ?? '',
                ];
            });

        return response()->json($reviews);
    }

    /**
     * GET reviews/mine — đánh giá của chính người đang đăng nhập.
     *
     * Không nhận shop: mỗi tài khoản chỉ có MỘT đánh giá về FunCafe, nên frontend
     * không được phép hỏi "đánh giá của tôi ở quán này" — hỏi vậy thì đổi sang quán
     * chưa từng đánh giá sẽ tưởng là chưa viết bao giờ.
     * Trả về null (không phải 404) khi chưa có: "chưa viết" là trạng thái bình thường.
     */
    public function mine(Request $request)
    {
        $review = Review::where('user_id', (string) $request->user()->id)
            ->with('package')
            ->first();

        if (!$review) {
            return response()->json(null);
        }

        $data = $review->toArray();
        unset($data['user'], $data['package']);
        $data['user_name'] = $request->user()->full_name;
        $data['package_name'] = $review->package?->name ?? '';

        return response()->json($data);
    }

    public function index(Shop $shop)
    {
        $this->authorizeShop($shop);

        $reviews = Review::where('shop_id', $shop->id)
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

    public function store(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);

        // Tiêu đề và nội dung BẮT BUỘC. Đánh giá chỉ có số sao trần trụi không nói được
        // gì với người đang cân nhắc dùng FunCafe, mà băng đánh giá ở trang chủ lại chỉ
        // dựng thẻ từ những cái có nội dung — nên bản thiếu nội dung vừa vô nghĩa với
        // người đọc, vừa im lặng biến mất với người viết.
        $validated = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'title' => 'required|string|max:255',
            'comment' => 'required|string|max:2000',
        ], [
            // Không có thư mục lang/vi trong dự án, để mặc định là người dùng nhận câu
            // tiếng Anh của Laravel ngay giữa một màn hình tiếng Việt.
            'rating.required'  => 'Vui lòng chọn số sao.',
            'rating.min'       => 'Vui lòng chọn số sao.',
            'title.required'   => 'Vui lòng nhập tiêu đề cho đánh giá.',
            'title.max'        => 'Tiêu đề không được dài quá 255 ký tự.',
            'comment.required' => 'Vui lòng nhập nội dung đánh giá.',
            'comment.max'      => 'Nội dung không được dài quá 2000 ký tự.',
        ]);

        $user = $request->user();
        // ĐA QUÁN: snapshot gói lấy theo gói active CỦA QUÁN đang đánh giá.
        $package = \App\Models\Subscription::where('shop_id', (string) $shop->id)
            ->where('status', 'active')
            ->first();

        // UPSERT theo NGƯỜI DÙNG, không theo cặp (người dùng + quán). Đây là đánh giá
        // về PHẦN MỀM FunCafe chứ không phải về từng quán, nên một chủ quán có 3 quán
        // vẫn chỉ có một tiếng nói. Trước đây truy vấn này lọc thêm shop_id nên ai có
        // 3 quán viết được 3 đánh giá, và cả 3 cùng lên trang chủ.
        // shop_id vẫn được GHI lại làm ngữ cảnh (đánh giá viết khi đang đứng ở quán nào).
        $existing = Review::where('user_id', (string) $user->id)->first();

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
                // Cập nhật cả shop_id: ngữ cảnh phải là quán mà chủ quán đang đứng lúc
                // sửa, nếu không trang chủ vẫn ghi tên quán đầu tiên họ từng dùng.
                'shop_id'    => (string) $shop->id,
                'package_id' => $package ? (string) $package->package_id : $existing->package_id,
                'history'    => $history,
            ]));
            $review = $existing->fresh();
            $statusCode = 200;
        } else {
            $review = Review::create(array_merge($validated, [
                'user_id' => (string) $user->id,
                'shop_id' => (string) $shop->id,
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
