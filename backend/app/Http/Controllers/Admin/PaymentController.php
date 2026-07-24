<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PackagePayment;

/**
 * Bảng theo dõi giao dịch mua gói — CHỈ ĐỌC.
 *
 * Đã gỡ (2026-07-22): approveRefund/rejectRefund và update.
 *  - Hai hàm duyệt hoàn tiền đều chặn bằng `credit_status` (khi đó còn tên refund_status), mà KHÔNG
 *    nơi nào trong hệ thống gán 'pending' (nâng cấp giữa kỳ cấn trừ thẳng =>
 *    'applied'). Tức là chúng không bao giờ chạy được.
 *  - update() cho phép sửa `amount` của một bản ghi tài chính do cổng thanh toán
 *    trả về — sai nghiệp vụ, và để hở endpoint là để hở luôn cả đường sửa bằng
 *    công cụ ngoài giao diện.
 */
class PaymentController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'admin']);
    }

    /**
     * Danh sách giao dịch để đối soát doanh thu.
     * Thanh toán qua cổng online (VNPay/MoMo) tự kích hoạt — admin KHÔNG duyệt tay,
     * nên ẩn các đơn cổng đang 'pending' (khách khởi tạo nhưng chưa trả / back giữa chừng).
     * Vẫn giữ đơn đã 'paid'/'rejected'/'failed' để đối soát.
     */
    public function index()
    {
        $payments = PackagePayment::with('subscription.user', 'subscription.package', 'user', 'package')
            ->where(function ($q) {
                $q->whereNotIn('payment_method', PackagePayment::ONLINE_GATEWAYS)
                  ->orWhere('payment_status', '!=', 'pending');
            })
            ->get();

        return response()->json($payments);
    }
}
