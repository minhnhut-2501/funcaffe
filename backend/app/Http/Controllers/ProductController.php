<?php

namespace App\Http\Controllers;

use App\Models\Shop;
use App\Models\Product;
use App\Models\ProductTopping;
use App\Http\Controllers\Concerns\ChecksShopAccess;
use App\Http\Controllers\Concerns\ChecksShopStatus;
use App\Http\Controllers\Concerns\EnforcesPackageLimits;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use ChecksShopAccess, EnforcesPackageLimits, ChecksShopStatus;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);
        $items = $shop->products()->with(['category', 'productSizes', 'productToppings.topping'])->get();
        return response()->json($items);
    }

    public function store(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);
        $this->guardSuaDoi($shop);
        $this->enforcePackageLimit($shop, 'products', $shop->products()->count());

        $validated = $request->validate([
            'category_id'        => 'required|string',
            'name'               => 'required|string|max:255',
            'base_price'         => 'required|numeric|min:0',
            'has_size'           => 'boolean',
            'has_topping'      => 'boolean',
            'is_available'       => 'boolean',
            'description'        => 'nullable|string',
            'image'              => 'nullable|string',
            'display_order'      => 'nullable|integer',
            'sizes'              => 'nullable|array',
            'sizes.*.name'       => 'nullable|string|max:100',
            'sizes.*.price'      => 'nullable|numeric|min:0',
            'sizes.*.is_active'  => 'boolean',
            // Topping gắn cho món (gộp vào form thêm/sửa món — không còn trang cấu hình riêng)
            'topping_ids'        => 'nullable|array',
            'topping_ids.*'      => 'string',
        ]);

        $hasSize  = !empty($validated['has_size']);
        $allSizes = $validated['sizes'] ?? [];
        // Lọc size hợp lệ: phải có tên
        $sizesData = array_values(array_filter($allSizes, fn($s) => !empty($s['name'])));

        if ($hasSize && empty($sizesData)) {
            return response()->json([
                'message' => 'Món có size thì phải nhập ít nhất một size.',
                'errors'  => ['sizes' => ['Món có size thì phải nhập ít nhất một size.']],
            ], 422);
        }

        if ($hasSize) {
            $names = array_map(fn($s) => trim($s['name']), $sizesData);
            if (count($names) !== count(array_unique($names))) {
                return response()->json([
                    'message' => 'Không được nhập trùng tên size.',
                    'errors'  => ['sizes' => ['Không được nhập trùng tên size trong cùng một món.']],
                ], 422);
            }
        }

        // Topping: chỉ gắn khi món cho phép topping; ngược lại để rỗng.
        $toppingIds = !empty($validated['has_topping']) ? ($validated['topping_ids'] ?? []) : [];
        unset($validated['sizes'], $validated['topping_ids']);
        if (isset($validated['base_price'])) {
            $validated['base_price'] = (int) round($validated['base_price']); // VND nguyên
        }
        $product = $shop->products()->create($validated);

        // Lưu size_name thẳng vào product_sizes — không cần sizes collection
        if ($hasSize) {
            foreach ($sizesData as $sizeData) {
                $product->productSizes()->create([
                    'size_name' => trim($sizeData['name']),
                    'price'     => (int) round($sizeData['price'] ?? 0),
                    'is_active' => $sizeData['is_active'] ?? true,
                ]);
            }
        }

        if (!$this->syncProductToppings($shop, $product, $toppingIds)) {
            return response()->json(['message' => 'Có topping không hợp lệ hoặc không thuộc quán của bạn.'], 422);
        }

        return response()->json($product->load(['category', 'productSizes', 'productToppings.topping']), 201);
    }

    public function update(Request $request, Shop $shop, Product $product)
    {
        $this->authorizeShop($shop);
        $this->guardSuaDoi($shop);

        if ((string) $product->shop_id !== (string) $shop->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'category_id'        => 'sometimes|string',
            'name'               => 'sometimes|string|max:255',
            'base_price'         => 'sometimes|numeric|min:0',
            'has_size'           => 'sometimes|boolean',
            'has_topping'      => 'sometimes|boolean',
            'is_available'       => 'sometimes|boolean',
            'description'        => 'nullable|string',
            'image'              => 'nullable|string',
            'display_order'      => 'nullable|integer',
            'sizes'              => 'nullable|array',
            'sizes.*.name'       => 'nullable|string|max:100',
            'sizes.*.price'      => 'nullable|numeric|min:0',
            'sizes.*.is_active'  => 'boolean',
            'topping_ids'        => 'nullable|array',
            'topping_ids.*'      => 'string',
        ]);

        $hasSizesInRequest = $request->has('sizes');
        $allSizes          = $hasSizesInRequest ? ($validated['sizes'] ?? []) : [];
        $sizesData         = array_values(array_filter($allSizes, fn($s) => !empty($s['name'])));

        $newHasSize = array_key_exists('has_size', $validated)
            ? !empty($validated['has_size'])
            : ($product->has_size ?? false);

        if ($newHasSize && $hasSizesInRequest && empty($sizesData)) {
            return response()->json([
                'message' => 'Món có size thì phải nhập ít nhất một size.',
                'errors'  => ['sizes' => ['Món có size thì phải nhập ít nhất một size.']],
            ], 422);
        }

        if ($newHasSize && $hasSizesInRequest) {
            $names = array_map(fn($s) => trim($s['name']), $sizesData);
            if (count($names) !== count(array_unique($names))) {
                return response()->json([
                    'message' => 'Không được nhập trùng tên size.',
                    'errors'  => ['sizes' => ['Không được nhập trùng tên size trong cùng một món.']],
                ], 422);
            }
        }

        $hasToppingsInRequest = $request->has('topping_ids');
        $requestedToppingIds = $validated['topping_ids'] ?? [];
        unset($validated['sizes'], $validated['topping_ids']);
        if (isset($validated['base_price'])) {
            $validated['base_price'] = (int) round($validated['base_price']); // VND nguyên
        }
        $product->update($validated);

        if ($hasSizesInRequest) {
            $product->productSizes()->delete();

            if ($newHasSize) {
                foreach ($sizesData as $sizeData) {
                    $product->productSizes()->create([
                        'size_name' => trim($sizeData['name']),
                        'price'     => (int) round($sizeData['price'] ?? 0),
                        'is_active' => $sizeData['is_active'] ?? true,
                    ]);
                }
            }
        }

        // Đồng bộ topping khi request có gửi topping_ids (form thêm/sửa món).
        // Món không cho phép topping -> xóa hết liên kết.
        if ($hasToppingsInRequest) {
            $newAllowTopping = array_key_exists('has_topping', $validated)
                ? !empty($validated['has_topping'])
                : ($product->has_topping ?? false);
            $ids = $newAllowTopping ? $requestedToppingIds : [];
            if (!$this->syncProductToppings($shop, $product, $ids)) {
                return response()->json(['message' => 'Có topping không hợp lệ hoặc không thuộc quán của bạn.'], 422);
            }
        }

        return response()->json($product->load(['category', 'productSizes', 'productToppings.topping']));
    }

    /**
     * Đồng bộ danh sách topping của món (xóa cũ, tạo lại). Chỉ nhận topping thuộc quán này.
     * @return bool false nếu có id topping lạ/không thuộc quán.
     */
    private function syncProductToppings(Shop $shop, Product $product, array $requestedIds): bool
    {
        $requestedIds = array_values(array_unique(array_filter($requestedIds)));

        if (empty($requestedIds)) {
            $product->productToppings()->delete();
            return true;
        }

        // Lưu ý: pluck('_id') trực tiếp trên query MongoDB trả về chuỗi rỗng
        // (quirk projection _id của mongodb/laravel-mongodb) — phải get() model
        // rồi đọc thuộc tính id để lấy đúng chuỗi ObjectId.
        $validIds = $shop->toppings()
            ->whereIn('_id', $requestedIds)
            ->get()
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();

        if (count($validIds) !== count($requestedIds)) {
            return false;
        }

        $product->productToppings()->delete();
        foreach ($validIds as $toppingId) {
            $product->productToppings()->create(['topping_id' => $toppingId]);
        }
        return true;
    }

    // destroy() đã bị GỠ BỎ có chủ đích: món từng bán được tham chiếu trong
    // order/hóa đơn cũ nên không cho xóa — chủ quán ẩn món qua is_available.

    // toppings() và updateToppings() đã bị GỠ BỎ cùng hai route của chúng.
    // Trang Thực đơn gắn topping cho món bằng trường `topping_ids` gửi kèm ngay
    // trong body của store()/update() — hai endpoint riêng chưa từng được gọi lần
    // nào. Việc đồng bộ vẫn do syncProductToppings() ở trên đảm nhiệm.
}
