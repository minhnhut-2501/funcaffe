<?php

namespace App\Http\Controllers;

use App\Models\Cafe;
use Illuminate\Http\Request;

class CafeController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        return response()->json($user->cafes);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'nullable|string',
            'phone' => 'nullable|string|max:20',
            'description' => 'nullable|string',
            'bank_bin' => 'nullable|string|max:20',
            'bank_account_number' => 'nullable|string|max:30',
            'bank_account_name' => 'nullable|string|max:255',
        ]);

        $cafe = $request->user()->cafes()->create($validated + ['status' => 'open']);

        return response()->json($cafe, 201);
    }

    public function show(Request $request, Cafe $cafe)
    {
        if ($cafe->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return response()->json($cafe);
    }

    public function update(Request $request, Cafe $cafe)
    {
        if ($cafe->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'address' => 'nullable|string',
            'phone' => 'nullable|string|max:20',
            'description' => 'nullable|string',
            'logo' => 'nullable|string',
            'status' => 'sometimes|string|in:open,closed,inactive',
            'bank_bin' => 'nullable|string|max:20',
            'bank_account_number' => 'nullable|string|max:30',
            'bank_account_name' => 'nullable|string|max:255',
        ]);

        $cafe->update($validated);
        return response()->json($cafe);
    }

    // KHÔNG có destroy(): quán là gốc của bàn, danh mục, món, topping, order, hóa đơn
    // và các gói đã mua. MongoDB không xóa dây chuyền nên xóa quán chỉ để lại một đống
    // dữ liệu mồ côi và làm mất luôn lịch sử doanh thu. Ngừng kinh doanh thì đặt
    // status = 'inactive' — dữ liệu còn nguyên để tra cứu, quán biến mất khỏi vận hành.
}
