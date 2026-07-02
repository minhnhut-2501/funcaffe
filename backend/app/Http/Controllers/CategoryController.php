<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Cafe;
use App\Http\Controllers\Concerns\ChecksCafeOwnership;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    use ChecksCafeOwnership;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);
        return response()->json($cafe->categories);
    }

    public function store(Request $request, Cafe $cafe)
    {
        $this->authorizeCafe($cafe);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $category = $cafe->categories()->create($validated + ['is_active' => true]);
        return response()->json($category, 201);
    }

    public function update(Request $request, Cafe $cafe, Category $category)
    {
        $this->authorizeCafe($cafe);

        if ($category->cafe_id !== $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $category->update($validated);
        return response()->json($category);
    }

    public function destroy(Cafe $cafe, Category $category)
    {
        $this->authorizeCafe($cafe);

        if ($category->cafe_id !== $cafe->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $category->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
