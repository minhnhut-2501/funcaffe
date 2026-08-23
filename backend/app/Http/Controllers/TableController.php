<?php

namespace App\Http\Controllers;

use App\Models\Shop;
use App\Models\ShopTable;
use App\Http\Controllers\Concerns\ChecksShopAccess;
use App\Http\Controllers\Concerns\ChecksShopStatus;
use App\Http\Controllers\Concerns\EnforcesPackageLimits;
use Illuminate\Http\Request;

class TableController extends Controller
{
    use ChecksShopAccess, EnforcesPackageLimits, ChecksShopStatus;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);
        return response()->json($shop->tables);
    }

    public function store(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);
        $this->guardSuaDoi($shop);
        $this->enforcePackageLimit($shop, 'tables', $shop->tables()->count());

        // KHÔNG nhận `status`. Trạng thái bàn được DẪN XUẤT từ đơn đang mở (xem
        // `tablesLive` ở màn Bán hàng); `tables.status` chỉ là bộ nhớ đệm để hiển thị.
        // Cho sửa tay ở đây là hứa một điều không có thật: chủ quán đặt "đang phục vụ"
        // xong quay sang màn Bán hàng vẫn thấy bàn trống, vì nơi đó không đọc trường này.
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'capacity' => 'required|integer|min:1',
            'display_order' => 'nullable|integer|min:0',
        ]);
        $validated['status'] = 'empty';
        $validated['is_active'] = true;

        if ($this->trungTen($shop, $validated['name'])) {
            return response()->json([
                'message' => 'Quán đã có bàn tên "' . trim($validated['name']) . '".',
                'errors'  => ['name' => ['Tên bàn bị trùng với một bàn đang có.']],
            ], 422);
        }

        $table = $shop->tables()->create($validated);
        return response()->json($table, 201);
    }

    public function update(Request $request, Shop $shop, ShopTable $table)
    {
        $this->authorizeShop($shop);
        $this->guardSuaDoi($shop);

        if ((string) $table->shop_id !== (string) $shop->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        // `status` không nhận ở đây — xem lý do ở store().
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'capacity' => 'sometimes|integer|min:1',
            'is_active' => 'sometimes|boolean',
            'display_order' => 'nullable|integer|min:0',
        ]);

        if (isset($validated['name']) && $this->trungTen($shop, $validated['name'], (string) $table->id)) {
            return response()->json([
                'message' => 'Quán đã có bàn tên "' . trim($validated['name']) . '".',
                'errors'  => ['name' => ['Tên bàn bị trùng với một bàn đang có.']],
            ], 422);
        }

        // Ẩn bàn đang có khách là làm mất lối thanh toán của chính đơn đó: bàn biến khỏi
        // màn Bán hàng trong khi đơn vẫn mở, không ai bấm vào đâu để thu tiền được nữa.
        // (Chốt chặn này trước đây nằm ở destroy(), nay chuyển sang đường ẩn.)
        if (($validated['is_active'] ?? true) === false && $this->dangCoKhach($shop, $table)) {
            return response()->json([
                'message' => 'Bàn đang có đơn chưa thanh toán, không ẩn được. Thanh toán hoặc hủy đơn trước đã.',
            ], 422);
        }

        $table->update($validated);
        return response()->json($table);
    }

    private function dangCoKhach(Shop $shop, ShopTable $table): bool
    {
        return $shop->orders()
            ->where('table_id', (string) $table->id)
            ->where('status', 'active')
            ->exists();
    }

    /**
     * Hai cái bàn cùng tên trong một quán là lỗi vận hành chứ không phải lỗi dữ liệu:
     * thu ngân nhìn sơ đồ thấy hai ô "Bàn 5", bưng nhầm đồ và thu nhầm tiền của bàn
     * bên cạnh. So sánh sau khi bỏ khoảng trắng thừa và bỏ phân biệt hoa thường —
     * "bàn 5" với "Bàn 5 " là cùng một cái bàn dưới mắt người dùng.
     */
    private function trungTen(Shop $shop, string $ten, ?string $boQuaId = null): bool
    {
        $chuan = mb_strtolower(trim($ten));

        return $shop->tables()->get()->contains(
            fn ($ban) => (string) $ban->id !== $boQuaId
                && mb_strtolower(trim((string) $ban->name)) === $chuan
        );
    }

}
