<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Shop;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Ý NGHĨA CỦA BA TRẠNG THÁI QUÁN (chốt ở 4.1.3).
 *
 *  - `open`     — Đang mở: bán hàng bình thường, sửa thực đơn bình thường.
 *  - `closed`   — Đã đóng cửa: hết giờ / nghỉ lễ. KHÔNG mở đơn mới, nhưng bàn đang
 *                 ngồi vẫn gọi thêm và thanh toán được, và chủ quán vẫn sửa thực đơn
 *                 chuẩn bị cho hôm sau.
 *  - `inactive` — Ngừng hoạt động: đóng hẳn. Chỉ còn tra cứu số liệu cũ; không bán,
 *                 không sửa thực đơn. Dữ liệu giữ nguyên (hệ thống không xóa quán).
 *
 * Ở cả hai trạng thái không mở, việc THANH TOÁN và HỦY đơn đang mở luôn được phép —
 * nếu không thì tiền của khách đang ngồi bị nhốt lại trong một cái bàn không ai chốt
 * được, và đó là cách chắc chắn nhất để mất số liệu.
 */
trait ChecksShopStatus
{
    /** Mở đơn MỚI: chỉ khi quán đang mở cửa. */
    protected function guardBanHang(Shop $shop): void
    {
        $trangThai = $shop->status ?? 'open';

        if ($trangThai === 'open') {
            return;
        }

        $ly_do = $trangThai === 'closed'
            ? 'Quán đang ở trạng thái "Đã đóng cửa" nên không mở đơn mới được. Đổi sang "Đang mở" ở trang Thông tin quán để bán tiếp.'
            : 'Quán đang ở trạng thái "Ngừng hoạt động" nên không bán hàng được.';

        throw new HttpResponseException(response()->json(['message' => $ly_do], 422));
    }

    /** Sửa thực đơn, bàn, danh mục: chặn khi quán đã ngừng hoạt động hẳn. */
    protected function guardSuaDoi(Shop $shop): void
    {
        if (($shop->status ?? 'open') !== 'inactive') {
            return;
        }

        throw new HttpResponseException(response()->json([
            'message' => 'Quán đang ở trạng thái "Ngừng hoạt động" nên chỉ tra cứu được, không thay đổi dữ liệu.',
        ], 422));
    }
}
