<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use App\Models\CafeTable;
use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use App\Http\Controllers\Concerns\EnforcesPackageLimits;
use Illuminate\Http\Request;

class TableController extends Controller
{
    use ChecksCafeOwnership, EnforcesPackageLimits;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);
        return response()->json($cafe->tables);
    }

    public function store(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);
        $this->enforcePackageLimit($cafe, 'tables', $cafe->tables()->count());

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'capacity' => 'required|integer|min:1',
            'status' => 'sometimes|string|in:empty,serving,reserved,cleaning',
            'display_order' => 'nullable|integer|min:0',
        ]);

        $table = $cafe->tables()->create($validated);
        return response()->json($table, 201);
    }

    public function update(Request $request, Cafe $cafe, CafeTable $table)
    {
        $this->authorizeCafe($cafe);

        if ($table->cafe_id !== $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'capacity' => 'sometimes|integer|min:1',
            'status' => 'sometimes|string|in:empty,serving,reserved,cleaning',
            'display_order' => 'nullable|integer|min:0',
        ]);

        $table->update($validated);
        return response()->json($table);
    }

    public function destroy(Cafe $cafe, CafeTable $table)
    {
        $this->authorizeCafe($cafe);

        if ($table->cafe_id !== $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $hasActiveOrder = $cafe->orders()->where('table_id', $table->id)->where('status', 'active')->exists();
        if ($hasActiveOrder) {
            return response()->json(['message' => 'Không thể xóa bàn đang có order chưa thanh toán'], 400);
        }

        $table->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
