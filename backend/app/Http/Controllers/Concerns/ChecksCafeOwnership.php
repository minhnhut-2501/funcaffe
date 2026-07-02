<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Cafe;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * BUG-FIX (IDOR): Đảm bảo quán thuộc về user đang đăng nhập.
 *
 * Trước đây chỉ method index() kiểm tra quyền sở hữu quán, còn
 * store/update/destroy/show/pay thì không. Một user có thể thao tác
 * dữ liệu của quán người khác chỉ bằng cách truyền cafe_id của họ.
 * Trait này tập trung việc kiểm tra để mọi action dùng chung.
 */
trait ChecksCafeOwnership
{
    protected function authorizeCafe(Cafe $cafe): void
    {
        $user = request()->user();

        if (!$user) {
            throw new HttpResponseException(
                response()->json(['message' => 'Unauthenticated'], 401)
            );
        }

        if ((string) $cafe->user_id !== (string) $user->id && $user->role !== 'admin') {
            throw new HttpResponseException(
                response()->json(['message' => 'Forbidden'], 403)
            );
        }
    }
}
