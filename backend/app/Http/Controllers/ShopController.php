<?php

namespace App\Http\Controllers;

use App\Models\Shop;
use App\Models\Subscription;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $shops = $user->shops;

        // Đính kèm gói MỚI NHẤT của TỪNG quán. Không có phần này thì frontend chỉ biết
        // hạn của quán đang chọn, nên không thể cảnh báo "quán khác của bạn sắp hết
        // hạn" — mà đó mới là trường hợp dễ quên nhất.
        //
        // KHÔNG dùng scope effective(): nó loại luôn gói đã quá hạn, mà quán hết hạn
        // mới chính là quán cần cảnh báo gấp nhất. Frontend tự phân loại theo end_date.
        // Xem Subscription::scopeLatestForShop() để biết vì sao hai khái niệm này khác
        // nhau và khi nào dùng cái nào.
        //
        // Một truy vấn cho tất cả các quán. Sắp xếp TĂNG DẦN vì keyBy giữ phần tử cuối
        // khi trùng khóa -> quán nào cũng giữ lại đúng gói có end_date lớn nhất.
        $subs = Subscription::whereIn('shop_id', $shops->pluck('id')->map(fn ($id) => (string) $id)->toArray())
            ->where('status', 'active')
            ->orderBy('end_date', 'asc')
            ->with('package')
            ->get()
            ->keyBy(fn ($s) => (string) $s->shop_id);

        $result = $shops->map(function ($shop) use ($subs) {
            $sub = $subs->get((string) $shop->id);
            $data = $shop->toArray();
            // 'none' chứ không 'free' khi không đọc được loại gói: gói Fun Free là bản
            // dùng thử Pro Max (không giới hạn bàn/món, có AI), nên lấy nó làm giá trị
            // dự phòng là cấp quyền cao nhất cho đúng lúc dữ liệu hỏng.
            $data['package_type'] = $sub ? ($sub->package->type ?? 'none') : 'none';
            $data['package_name'] = $sub ? ($sub->package->name ?? '') : '';
            $data['package_end_date'] = $sub?->end_date;
            return $data;
        })->values();

        return response()->json($result);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'nullable|string',
            'phone' => 'nullable|string|max:20',
            'description' => 'nullable|string',
            'bank_bin' => 'nullable|string|max:20',
            'bank_account_number' => 'nullable|string|max:30',
            'bank_account_name' => 'nullable|string|max:255',
        ]);

        $shop = $request->user()->shops()->create($validated + ['status' => 'open']);

        return response()->json($shop, 201);
    }

    public function show(Request $request, Shop $shop)
    {
        if ($shop->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return response()->json($shop);
    }

    public function update(Request $request, Shop $shop)
    {
        if ($shop->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'address' => 'nullable|string',
            'phone' => 'nullable|string|max:20',
            'description' => 'nullable|string',
            'logo' => 'nullable|string',
            'status' => 'sometimes|string|in:open,closed,inactive',
            'bank_bin' => 'nullable|string|max:20',
            'bank_account_number' => 'nullable|string|max:30',
            'bank_account_name' => 'nullable|string|max:255',
        ]);

        $shop->update($validated);
        return response()->json($shop);
    }

    // KHÔNG có destroy(): quán là gốc của bàn, danh mục, món, topping, order, hóa đơn
    // và các gói đã mua. MongoDB không xóa dây chuyền nên xóa quán chỉ để lại một đống
    // dữ liệu mồ côi và làm mất luôn lịch sử doanh thu. Ngừng kinh doanh thì đặt
    // status = 'inactive' — dữ liệu còn nguyên để tra cứu, quán biến mất khỏi vận hành.
}
