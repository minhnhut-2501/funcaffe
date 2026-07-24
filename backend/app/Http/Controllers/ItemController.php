<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use App\Models\Item;
use App\Models\ItemTopping;
use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use App\Http\Controllers\Concerns\EnforcesPackageLimits;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    use ChecksCafeOwnership, EnforcesPackageLimits;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);
        $items = $cafe->items()->with(['category', 'itemPrices', 'itemToppings.topping'])->get();
        return response()->json($items);
    }

    public function store(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);
        $this->enforcePackageLimit($cafe, 'items', $cafe->items()->count());

        $validated = $request->validate([
            'category_id'        => 'required|string',
            'name'               => 'required|string|max:255',
            'base_price'         => 'required|numeric|min:0',
            'has_size'           => 'boolean',
            'allow_topping'      => 'boolean',
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
        $toppingIds = !empty($validated['allow_topping']) ? ($validated['topping_ids'] ?? []) : [];
        unset($validated['sizes'], $validated['topping_ids']);
        if (isset($validated['base_price'])) {
            $validated['base_price'] = (int) round($validated['base_price']); // VND nguyên
        }
        $item = $cafe->items()->create($validated);

        // Lưu size_name thẳng vào item_prices — không cần sizes collection
        if ($hasSize) {
            foreach ($sizesData as $sizeData) {
                $item->itemPrices()->create([
                    'size_name' => trim($sizeData['name']),
                    'price'     => (int) round($sizeData['price'] ?? 0),
                    'is_active' => $sizeData['is_active'] ?? true,
                ]);
            }
        }

        if (!$this->syncItemToppings($cafe, $item, $toppingIds)) {
            return response()->json(['message' => 'Có topping không hợp lệ hoặc không thuộc quán của bạn.'], 422);
        }

        return response()->json($item->load(['category', 'itemPrices', 'itemToppings.topping']), 201);
    }

    public function update(Request $request, Cafe $cafe, Item $item)
    {
        $this->authorizeCafe($cafe);

        if ((string) $item->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'category_id'        => 'sometimes|string',
            'name'               => 'sometimes|string|max:255',
            'base_price'         => 'sometimes|numeric|min:0',
            'has_size'           => 'sometimes|boolean',
            'allow_topping'      => 'sometimes|boolean',
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
            : ($item->has_size ?? false);

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
        $item->update($validated);

        if ($hasSizesInRequest) {
            $item->itemPrices()->delete();

            if ($newHasSize) {
                foreach ($sizesData as $sizeData) {
                    $item->itemPrices()->create([
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
            $newAllowTopping = array_key_exists('allow_topping', $validated)
                ? !empty($validated['allow_topping'])
                : ($item->allow_topping ?? false);
            $ids = $newAllowTopping ? $requestedToppingIds : [];
            if (!$this->syncItemToppings($cafe, $item, $ids)) {
                return response()->json(['message' => 'Có topping không hợp lệ hoặc không thuộc quán của bạn.'], 422);
            }
        }

        return response()->json($item->load(['category', 'itemPrices', 'itemToppings.topping']));
    }

    /**
     * Đồng bộ danh sách topping của món (xóa cũ, tạo lại). Chỉ nhận topping thuộc quán này.
     * @return bool false nếu có id topping lạ/không thuộc quán.
     */
    private function syncItemToppings(Cafe $cafe, Item $item, array $requestedIds): bool
    {
        $requestedIds = array_values(array_unique(array_filter($requestedIds)));

        if (empty($requestedIds)) {
            $item->itemToppings()->delete();
            return true;
        }

        // Lưu ý: pluck('_id') trực tiếp trên query MongoDB trả về chuỗi rỗng
        // (quirk projection _id của mongodb/laravel-mongodb) — phải get() model
        // rồi đọc thuộc tính id để lấy đúng chuỗi ObjectId.
        $validIds = $cafe->toppings()
            ->whereIn('_id', $requestedIds)
            ->get()
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();

        if (count($validIds) !== count($requestedIds)) {
            return false;
        }

        $item->itemToppings()->delete();
        foreach ($validIds as $toppingId) {
            $item->itemToppings()->create(['topping_id' => $toppingId]);
        }
        return true;
    }

    // destroy() đã bị GỠ BỎ có chủ đích: món từng bán được tham chiếu trong
    // order/hóa đơn cũ nên không cho xóa — chủ quán ẩn món qua is_available.

    public function toppings(Cafe $cafe, Item $item)
    {
        $this->authorizeCafe($cafe);

        if ((string) $item->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $toppingIds = $item->itemToppings()->pluck('topping_id');
        return response()->json($toppingIds);
    }

    public function updateToppings(Request $request, Cafe $cafe, Item $item)
    {
        $this->authorizeCafe($cafe);

        if ((string) $item->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'topping_ids'   => 'required|array',
            'topping_ids.*' => 'required|string',
        ]);

        // C2: topping gắn vào món PHẢI thuộc quán này — chặn id lạ/quán khác
        if (!$this->syncItemToppings($cafe, $item, $validated['topping_ids'])) {
            return response()->json(['message' => 'Có topping không hợp lệ hoặc không thuộc quán của bạn.'], 422);
        }

        return response()->json([
            'message'     => 'Đã lưu cấu hình topping.',
            'topping_ids' => $item->itemToppings()->pluck('topping_id'),
        ]);
    }
}
