<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tài khoản bị khóa thì token đang cầm cũng hết dùng được — NGAY, không đợi đăng xuất.
 *
 * `Admin\UserController::toggleLock()` đã thu hồi token lúc khóa, nhưng đó là ghi nhớ
 * của một chỗ gọi. Trạng thái `locked` có thể được đặt bằng đường khác (sửa tay trong
 * CSDL khi xử lý sự cố, một tác vụ nền sau này, hay đơn giản là một chỗ gọi mới mà
 * người viết quên thu hồi token). Khi đó tài khoản bị khóa vẫn bán hàng bình thường.
 * Chốt chặn đặt ở đây thì luật "khóa là không vào được" đúng bất kể ai đặt trạng thái.
 *
 * Chạy TRƯỚC `auth:sanctum` (nằm trong nhóm `api`) nên phải tự hỏi guard sanctum thay
 * vì dùng `$request->user()` — guard mặc định lúc này chưa được chọn. Không có token
 * thì bỏ qua, để `auth:sanctum` lo chuyện chưa đăng nhập như trước.
 *
 * Trả **401 chứ không 403**: token thật sự không còn giá trị. 401 khiến `api-client`
 * xóa token và đưa về trang đăng nhập — nơi người dùng đọc được đúng lý do ("Tài khoản
 * của bạn đã bị khóa"). Trả 403 thì họ ngồi lại trong khu làm việc với một màn hình
 * đầy thông báo "không có quyền" mà không hiểu vì sao.
 */
class EnsureAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');

        if ($user && $user->status === 'locked') {
            // Dọn luôn token vừa dùng: lần sau không phải đi tới đây nữa.
            $user->tokens()->delete();

            return response()->json([
                'message' => 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
            ], 401);
        }

        return $next($request);
    }
}
