<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Shop;
use App\Http\Controllers\Concerns\ChecksShopAccess;
use App\Http\Controllers\Concerns\ChecksShopStatus;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    use ChecksShopAccess, ChecksShopStatus;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);
        return response()->json($shop->categories);
    }

    public function store(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);
        $this->guardSuaDoi($shop);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        if ($this->trungTen($shop, $validated['name'])) {
            return response()->json([
                'message' => 'Quán đã có danh mục tên "' . trim($validated['name']) . '".',
                'errors'  => ['name' => ['Tên danh mục bị trùng với một danh mục đang có.']],
            ], 422);
        }

        $category = $shop->categories()->create($validated + ['is_active' => true]);
        return response()->json($category, 201);
    }

    public function update(Request $request, Shop $shop, Category $category)
    {
        $this->authorizeShop($shop);
        $this->guardSuaDoi($shop);

        if ((string) $category->shop_id !== (string) $shop->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($validated['name']) && $this->trungTen($shop, $validated['name'], (string) $category->id)) {
            return response()->json([
                'message' => 'Quán đã có danh mục tên "' . trim($validated['name']) . '".',
                'errors'  => ['name' => ['Tên danh mục bị trùng với một danh mục đang có.']],
            ], 422);
        }

        $category->update($validated);
        return response()->json($category);
    }

    /**
     * Hai danh mục cùng tên thì tab trên trang Thực đơn hiện hai ô giống hệt nhau,
     * chủ quán không biết món mới rơi vào ô nào. Tính cả danh mục đang ẩn: nó vẫn
     * chiếm tên đó và có thể được bật lại bất cứ lúc nào.
     */
    private function trungTen(Shop $shop, string $ten, ?string $boQuaId = null): bool
    {
        $chuan = mb_strtolower(trim($ten));

        return $shop->categories()->get()->contains(
            fn ($dm) => (string) $dm->id !== $boQuaId
                && mb_strtolower(trim((string) $dm->name)) === $chuan
        );
    }

    // destroy() đã bị GỠ BỎ có chủ đích: xóa danh mục sẽ bỏ rơi các món bên
    // trong (categoryId trỏ tới danh mục đã chết) — chỉ ẨN qua is_active.
}
