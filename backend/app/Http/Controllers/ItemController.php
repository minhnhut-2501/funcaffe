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

        unset($validated['sizes']);
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

        unset($validated['sizes']);
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

        return response()->json($item->load(['category', 'itemPrices', 'itemToppings.topping']));
    }

    public function destroy(Cafe $cafe, Item $item)
    {
        $this->authorizeCafe($cafe);

        if ((string) $item->cafe_id !== (string) $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $item->delete();
        return response()->json(['message' => 'Deleted']);
    }

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

        $item->itemToppings()->delete();

        foreach ($validated['topping_ids'] as $toppingId) {
            $item->itemToppings()->create(['topping_id' => $toppingId]);
        }

        return response()->json([
            'message'    => 'Đã lưu cấu hình topping.',
            'topping_ids' => $validated['topping_ids'],
        ]);
    }
}
