<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Package;
use Illuminate\Http\Request;

class PackageController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'admin']);
    }

    public function index()
    {
        return response()->json(Package::all());
    }

    public function update(Request $request, Package $package)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|string|in:free,pro,promax',
            'is_trial' => 'sometimes|boolean',
            'can_use_ai' => 'sometimes|boolean',
            'max_tables' => 'nullable|integer|min:1',
            'max_menu_items' => 'nullable|integer|min:1',
            'features' => 'nullable|array',
            'features.*' => 'string',
            'status' => 'sometimes|string|in:active,inactive',
            'description' => 'nullable|string',
        ]);

        $package->update($validated);
        return response()->json($package);
    }
}
