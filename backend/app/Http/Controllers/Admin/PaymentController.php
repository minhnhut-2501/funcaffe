<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PackagePayment;

/**
 * Bảng theo dõi giao dịch mua gói — CHỈ ĐỌC.
 *
 * Đã gỡ (2026-07-22): approveRefund/rejectRefund và update.
 *  - Hai hàm duyệt hoàn tiền đều chặn bằng cờ trạng thái cấn trừ cũ (`credit_status`/`refund_status`),
 *    mà KHÔNG nơi nào gán 'pending' (nâng cấp giữa kỳ cấn trừ thẳng). Tức là chúng không bao giờ
 *    chạy được; cờ đó nay đã được gỡ, chỉ còn `credit_amount` như dòng biên lai.
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
        // Người trả tiền lấy từ chính giao dịch (`user`), không đi vòng qua
        // subscription: subscription không còn giữ user_id nữa.
        // timeSubscription: nguồn DUY NHẤT của thời hạn đã mua (duration_value +
        // duration_unit). Thiếu nó thì frontend không có gì để hiển thị ở cột "Thời hạn"
        // — trước đây nó đọc `duration_months`, một trường chưa từng tồn tại ở backend,
        // nên mọi giao dịch đều rơi về giá trị mặc định và hiện "1 tháng".
        $payments = PackagePayment::with('subscription.package', 'user', 'package', 'timeSubscription')
            ->where(function ($q) {
                $q->whereNotIn('payment_method', PackagePayment::ONLINE_GATEWAYS)
                  ->orWhere('payment_status', '!=', 'pending');
            })
            // Đối soát thì giao dịch mới nhất mới là thứ cần nhìn trước.
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($payments);
    }
}
