<?php

namespace App\Http\Controllers;

use App\Models\Shop;
use App\Models\Topping;
use App\Http\Controllers\Concerns\ChecksShopAccess;
use App\Http\Controllers\Concerns\ChecksShopStatus;
use Illuminate\Http\Request;

class ToppingController extends Controller
{
    use ChecksShopAccess, ChecksShopStatus;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);
        return response()->json($shop->toppings);
    }

    public function store(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);
        $this->guardSuaDoi($shop);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'is_available' => 'boolean',
            'image' => 'nullable|string',
        ]);

        // Tiền Việt không có đơn vị lẻ hơn đồng. Món đã làm tròn thành số nguyên ở
        // ProductController; topping thì chưa, nên giá 5000.5 lọt được vào CSDL rồi nhân
        // với số phần và số ly ở OrderController — hóa đơn ra số lẻ mà không ai gõ.
        $validated['price'] = (int) round($validated['price']);

        $topping = $shop->toppings()->create($validated);
        return response()->json($topping, 201);
    }

    public function update(Request $request, Shop $shop, Topping $topping)
    {
        $this->authorizeShop($shop);
        $this->guardSuaDoi($shop);

        if ((string) $topping->shop_id !== (string) $shop->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'price' => 'sometimes|numeric|min:0',
            'is_available' => 'sometimes|boolean',
            'image' => 'nullable|string',
        ]);

        if (isset($validated['price'])) {
            $validated['price'] = (int) round($validated['price']);
        }

        $topping->update($validated);
        return response()->json($topping);
    }

    // destroy() đã bị GỠ BỎ có chủ đích: topping từng bán còn trong hóa đơn cũ
    // và cấu hình gắn món (product_toppings) — chỉ ẨN qua is_available.
}
