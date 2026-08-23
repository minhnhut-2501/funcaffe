<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Shop;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * TẦNG 1 của phân quyền: người đang đăng nhập có được động vào quán này không.
 *
 * BUG-FIX (IDOR): trước đây chỉ index() kiểm quyền sở hữu, còn
 * store/update/destroy/show/pay thì không — một user thao tác được dữ liệu quán
 * người khác chỉ bằng cách truyền shop_id của họ. Trait này gom việc kiểm về một chỗ.
 *
 * TẦNG 2 nằm ở middleware `chu-quan`: vào được quán chưa có nghĩa là làm được mọi
 * thứ trong đó. Nhân viên đọc được thực đơn để bán, nhưng không được sửa giá, không
 * xem doanh thu, và tuyệt đối không mua gói bằng tiền của chủ.
 */
trait ChecksShopAccess
{
    protected function authorizeShop(Shop $shop): void
    {
        $user = request()->user();

        if (!$user) {
            throw new HttpResponseException(
                response()->json(['message' => 'Unauthenticated'], 401)
            );
        }

        if ($this->duocVaoQuan($user, $shop)) {
            return;
        }

        throw new HttpResponseException(
            response()->json(['message' => 'Forbidden'], 403)
        );
    }

    private function duocVaoQuan($user, Shop $shop): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        // Chủ quán.
        if ((string) $shop->user_id === (string) $user->id) {
            return true;
        }

        /*
         * Nhân viên — chỉ đúng quán mình làm.
         *
         * `!empty()` là phần bắt buộc chứ không phải cho đẹp: `shop_id` là trường TÙY
         * CHỌN, và nếu nó trống thì `(string) null === (string) $shop->id` vẫn có thể
         * đúng ở một tình huống nào đó của dữ liệu hỏng. Trống phải nghĩa là KHÔNG VÀO
         * ĐƯỢC QUÁN NÀO, chứ không phải vào được mọi quán. Hỏng dữ liệu thì khóa chặt.
         */
        return $user->laNhanVien()
            && !empty($user->shop_id)
            && (string) $user->shop_id === (string) $shop->id;
    }
}
