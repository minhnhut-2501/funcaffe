<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * TẦNG 2 của phân quyền: chặn NHÂN VIÊN ở mọi việc không phải bán hàng.
 *
 * `ChecksShopAccess` trả lời "được vào quán nào"; lớp này trả lời "làm được gì trong
 * đó". Nhân viên vào được quán mình làm — cần thế để đọc thực đơn mà bán — nhưng
 * không được sửa giá món, không xem doanh thu, và tuyệt đối không mua gói bằng tiền
 * của chủ quán.
 *
 * DANH SÁCH ĐEN, không phải danh sách trắng: gắn `chu-quan` vào tuyến nào thì tuyến
 * đó cấm nhân viên. Nghĩa là tuyến MỚI thêm sau này mặc định nhân viên VÀO ĐƯỢC —
 * đúng chiều nguy hiểm. Chốt chặn cho chuyện đó là `StaffPermissionTest`: nó duyệt
 * toàn bộ bảng tuyến và bắt lỗi ngay khi có tuyến chưa được phân loại.
 */
class OwnerOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->laNhanVien()) {
            return response()->json([
                'message' => 'Tài khoản nhân viên chỉ dùng được màn hình Bán hàng.',
            ], 403);
        }

        return $next($request);
    }
}
