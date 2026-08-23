<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Shop;
use App\Models\Package;
use App\Models\Subscription;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Giới hạn tài nguyên theo gói dịch vụ của chủ quán (chặn phía server, không
 * chỉ ẩn nút ở UI). Giới hạn KHÔNG còn hardcode: đọc trực tiếp từ gói
 * (`packages.max_tables`, `packages.max_menu_items`) do admin cấu hình.
 *   - null / không có giá trị => không giới hạn.
 *
 * Phải khớp với nguồn chân lý phía frontend `src/lib/permission.ts`.
 */
trait EnforcesPackageLimits
{
    /**
     * Gói đang hiệu lực của chủ quán, lấy theo subscription active mới nhất.
     * Trả null khi user chưa có gói (việc chặn do tầng khác lo: canEdit / LockedButton).
     */
    protected function effectivePackage(Shop $shop): ?Package
    {
        // B5: dùng scope effective() (active + còn hạn) — trước đây chỉ lọc status
        // nên gói đã quá end_date vẫn được tính là còn gói.
        // ĐA QUÁN: gói tính theo CHÍNH QUÁN (shop_id), không theo chủ quán.
        $sub = Subscription::where('shop_id', (string) $shop->id)
            ->effective()
            ->latest()
            ->first();

        if (!$sub) {
            return null;
        }

        return Package::find($sub->package_id);
    }

    /**
     * Ném lỗi 422 khi thao tác tạo mới vượt giới hạn của gói.
     * $resource: 'tables' | 'products' | 'staff'.
     */
    protected function enforcePackageLimit(Shop $shop, string $resource, int $currentCount): void
    {
        $pkg = $this->effectivePackage($shop);

        if (!$pkg) {
            return; // chưa có gói active — không thuộc phạm vi giới hạn số lượng
        }

        $max = match ($resource) {
            'tables' => $pkg->max_tables,
            'staff'  => $pkg->max_staff,
            default  => $pkg->max_menu_items,
        };

        if ($max === null) {
            return; // không giới hạn
        }

        if ($currentCount >= $max) {
            $label = match ($resource) {
                'tables' => 'bàn',
                'staff'  => 'tài khoản nhân viên',
                default  => 'món',
            };
            throw new HttpResponseException(response()->json([
                'message' => "Gói {$pkg->name} chỉ cho phép tối đa {$max} {$label}. Nâng cấp gói để dùng nhiều hơn.",
            ], 422));
        }
    }
}
