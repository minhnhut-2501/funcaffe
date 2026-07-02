<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TimeSubscription;
use App\Models\Package;
use Illuminate\Http\Request;

class TimeSubscriptionController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'admin']);
    }

    public function index()
    {
        return response()->json(TimeSubscription::with('package')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'package_id' => 'required|string',
            'duration_value' => 'required|integer|min:1',
            'duration_unit' => 'required|string|in:day,month',
            'price' => 'required|numeric|min:0',
            'label' => 'required|string|max:255',
            'status' => 'sometimes|string|in:active,inactive',
        ]);

        $timeSub = TimeSubscription::create($validated + ['status' => 'active']);
        return response()->json($timeSub, 201);
    }

    public function update(Request $request, TimeSubscription $timeSubscription)
    {
        $validated = $request->validate([
            'duration_value' => 'sometimes|integer|min:1',
            'duration_unit' => 'sometimes|string|in:day,month',
            'price' => 'sometimes|numeric|min:0',
            'label' => 'sometimes|string|max:255',
            'status' => 'sometimes|string|in:active,inactive',
        ]);

        $timeSubscription->update($validated);
        return response()->json($timeSubscription);
    }

    public function destroy(TimeSubscription $timeSubscription)
    {
        $timeSubscription->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
