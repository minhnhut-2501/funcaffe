<?php

namespace App\Http\Middleware;

use App\Models\Cafe;
use App\Models\Package;
use App\Models\Subscription;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Chốt chặn quyền dùng AI phía server: chỉ user có gói CÒN HIỆU LỰC và gói đó
 * bật can_use_ai (mặc định chỉ Pro Max) mới gọi được endpoint AI.
 *
 * Đây là nguồn chân lý — frontend chỉ khóa nút cho đẹp (src/lib/permission.ts
 * canUseAI). Logic đọc gói khớp trait EnforcesPackageLimits::effectivePackage.
 */
class RequiresAI
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // ĐA QUÁN: quyền AI tính theo gói CỦA QUÁN (route cafes/{cafe}/ai/...), không theo tài khoản.
        $cafe = $request->route('cafe');
        $cafeId = $cafe instanceof Cafe ? (string) $cafe->id : (string) $cafe;

        $sub = $cafeId
            ? Subscription::where('cafe_id', $cafeId)->effective()->latest()->first()
            : null;

        $pkg = $sub ? Package::find($sub->package_id) : null;

        if (!$pkg || !($pkg->can_use_ai ?? false)) {
            return response()->json([
                'message' => 'Tính năng AI chỉ có ở gói Pro Max. Nâng cấp gói để sử dụng.',
            ], 403);
        }

        return $next($request);
    }
}
