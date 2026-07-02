<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Cafe;
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
    protected function effectivePackage(Cafe $cafe): ?Package
    {
        $sub = Subscription::where('user_id', (string) $cafe->user_id)
            ->where('status', 'active')
            ->latest()
            ->first();

        if (!$sub) {
            return null;
        }

        return Package::find($sub->package_id);
    }

    /**
     * Ném lỗi 422 khi thao tác tạo mới vượt giới hạn của gói.
     * $resource: 'tables' | 'items'.
     */
    protected function enforcePackageLimit(Cafe $cafe, string $resource, int $currentCount): void
    {
        $pkg = $this->effectivePackage($cafe);

        if (!$pkg) {
            return; // chưa có gói active — không thuộc phạm vi giới hạn số lượng
        }

        $max = $resource === 'tables' ? $pkg->max_tables : $pkg->max_menu_items;

        if ($max === null) {
            return; // không giới hạn
        }

        if ($currentCount >= $max) {
            $label = $resource === 'tables' ? 'bàn' : 'món';
            throw new HttpResponseException(response()->json([
                'message' => "Gói {$pkg->name} chỉ cho phép tối đa {$max} {$label}. Nâng cấp gói để dùng nhiều hơn.",
            ], 422));
        }
    }
}
