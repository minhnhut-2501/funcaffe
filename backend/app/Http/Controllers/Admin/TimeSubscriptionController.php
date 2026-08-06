<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TimeSubscription;
use App\Models\Package;
use Illuminate\Http\Request;

class TimeSubscriptionController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'admin']);
    }

    public function index()
    {
        return response()->json(TimeSubscription::with('package')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'package_id' => 'required|string',
            'duration_value' => 'required|integer|min:1',
            'duration_unit' => 'required|string|in:day,month',
            'price' => 'required|numeric|min:0',
            'label' => 'required|string|max:255',
            'status' => 'sometimes|string|in:active,inactive',
        ]);

        $timeSub = TimeSubscription::create($validated + ['status' => 'active']);
        return response()->json($timeSub, 201);
    }

    public function update(Request $request, TimeSubscription $timeSubscription)
    {
        $validated = $request->validate([
            'duration_value' => 'sometimes|integer|min:1',
            'duration_unit' => 'sometimes|string|in:day,month',
            'price' => 'sometimes|numeric|min:0',
            'label' => 'sometimes|string|max:255',
            'status' => 'sometimes|string|in:active,inactive',
        ]);

        $timeSubscription->update($validated);
        return response()->json($timeSubscription);
    }

    /**
     * ẨN một mốc thời hạn (status = 'inactive') thay vì xóa khỏi CSDL.
     *
     * KHÔNG được xóa cứng: subscriptions và package_payments đều lưu
     * time_subscription_id, và SubscriptionActivator::computeRenewEndDate() đọc lại
     * bản ghi này SAU ĐÓ để biết cộng thêm bao nhiêu ngày khi cổng xác nhận thanh
     * toán. Không tìm thấy thì nó rơi về addMonth() — khách trả tiền 12 tháng chỉ
     * được gia hạn 1 tháng, không cảnh báo gì.
     *
     * Ẩn là đủ: endpoint công khai đã lọc status='active' nên mốc ẩn biến mất khỏi
     * trang mua gói, còn dữ liệu cũ vẫn tra cứu được.
     * Cùng nguyên tắc "không xóa, chỉ ẩn" đang áp cho quán, danh mục, món và topping.
     */
    public function destroy(TimeSubscription $timeSubscription)
    {
        $timeSubscription->update(['status' => 'inactive']);
        return response()->json($timeSubscription);
    }
}
