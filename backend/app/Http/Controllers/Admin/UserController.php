<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Subscription;
use App\Models\Cafe;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'admin']);
    }

    // BUG-16 FIX: Trả về thông tin gói dịch vụ và tên quán cho mỗi user
    public function index()
    {
        $users = User::paginate(50);

        $userIds = $users->pluck('_id')->map(fn($id) => (string) $id)->toArray();

        // Lấy subscription active cho từng user
        $subscriptions = Subscription::whereIn('user_id', $userIds)
            ->where('status', 'active')
            ->where('end_date', '>', now())
            ->with('package')
            ->get()
            ->keyBy('user_id');

        // Lấy cafe đầu tiên của từng user
        $cafes = Cafe::whereIn('user_id', $userIds)
            ->get()
            ->keyBy('user_id');

        $result = $users->map(function ($user) use ($subscriptions, $cafes) {
            $userId = (string) $user->_id;
            $sub = $subscriptions->get($userId);
            $cafe = $cafes->get($userId);

            $data = $user->toArray();
            $data['package_type'] = $sub ? ($sub->package->type ?? 'free') : 'none';
            $data['package_name'] = $sub ? ($sub->package->name ?? '') : '';
            $data['cafe_name'] = $cafe ? $cafe->name : null;
            return $data;
        });

        return response()->json([
            'data' => $result,
            'total' => $users->total(),
            'per_page' => $users->perPage(),
            'current_page' => $users->currentPage(),
            'last_page' => $users->lastPage(),
        ]);
    }

    public function toggleLock(User $user)
    {
        $user->update([
            'status' => $user->status === 'active' ? 'locked' : 'active',
        ]);

        return response()->json($user);
    }
}
