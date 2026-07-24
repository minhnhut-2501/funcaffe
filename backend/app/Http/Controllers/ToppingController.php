<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use App\Models\Topping;
use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use Illuminate\Http\Request;

class ToppingController extends Controller
{
    use ChecksCafeOwnership;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);
        return response()->json($cafe->toppings);
    }

    public function store(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'is_available' => 'boolean',
            'image' => 'nullable|string',
        ]);

        $topping = $cafe->toppings()->create($validated);
        return response()->json($topping, 201);
    }

    public function update(Request $request, Cafe $cafe, Topping $topping)
    {
        $this->authorizeCafe($cafe);

        if ($topping->cafe_id !== $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'price' => 'sometimes|numeric|min:0',
            'is_available' => 'sometimes|boolean',
            'image' => 'nullable|string',
        ]);

        $topping->update($validated);
        return response()->json($topping);
    }

    // destroy() đã bị GỠ BỎ có chủ đích: topping từng bán còn trong hóa đơn cũ
    // và cấu hình gắn món (item_toppings) — chỉ ẨN qua is_available.
}
