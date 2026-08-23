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

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'capacity' => 'required|integer|min:1',
            'status' => 'sometimes|string|in:empty,serving',
            'display_order' => 'nullable|integer|min:0',
        ]);

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

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'capacity' => 'sometimes|integer|min:1',
            'status' => 'sometimes|string|in:empty,serving',
            'display_order' => 'nullable|integer|min:0',
        ]);

        if (isset($validated['name']) && $this->trungTen($shop, $validated['name'], (string) $table->id)) {
            return response()->json([
                'message' => 'Quán đã có bàn tên "' . trim($validated['name']) . '".',
                'errors'  => ['name' => ['Tên bàn bị trùng với một bàn đang có.']],
            ], 422);
        }

        $table->update($validated);
        return response()->json($table);
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

    public function destroy(Shop $shop, ShopTable $table)
    {
        $this->authorizeShop($shop);
        $this->guardSuaDoi($shop);

        if ((string) $table->shop_id !== (string) $shop->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $hasActiveOrder = $shop->orders()->where('table_id', $table->id)->where('status', 'active')->exists();
        if ($hasActiveOrder) {
            return response()->json(['message' => 'Không thể xóa bàn đang có order chưa thanh toán'], 400);
        }

        $table->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
