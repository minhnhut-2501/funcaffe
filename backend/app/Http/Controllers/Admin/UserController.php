<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Subscription;
use App\Models\Cafe;
use App\Models\PackagePayment;
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

        // ĐA QUÁN: mỗi user có nhiều quán, mỗi quán có gói riêng. Gom quán theo user,
        // và gói active theo TỪNG QUÁN (cafe_id).
        $cafesByUser = Cafe::whereIn('user_id', $userIds)
            ->get()
            ->groupBy(fn($c) => (string) $c->user_id);

        $cafeIds = Cafe::whereIn('user_id', $userIds)->get()->pluck('id')->map(fn($id) => (string) $id)->toArray();

        $subsByCafe = Subscription::whereIn('cafe_id', $cafeIds)
            ->effective()
            ->with('package')
            ->get()
            ->keyBy(fn($s) => (string) $s->cafe_id);

        // Lịch sử chi tiêu: gom SẴN theo user bằng MỘT truy vấn thay vì hỏi lại trong
        // vòng lặp — 50 user/trang mà query trong vòng lặp là 50 lượt đi CSDL.
        // Chỉ tính giao dịch đã thanh toán: pending/failed không phải tiền thật.
        $paymentsByUser = PackagePayment::whereIn('user_id', $userIds)
            ->where('payment_status', 'paid')
            ->get()
            ->groupBy(fn($p) => (string) $p->user_id);

        $result = $users->map(function ($user) use ($cafesByUser, $subsByCafe, $paymentsByUser) {
            $userId = (string) $user->_id;
            $cafes = $cafesByUser->get($userId, collect());

            $cafeList = $cafes->map(function ($cafe) use ($subsByCafe) {
                $sub = $subsByCafe->get((string) $cafe->id);
                return [
                    'id' => (string) $cafe->id,
                    'name' => $cafe->name,
                    // open | closed | inactive — quán không xóa được, chỉ đổi trạng thái
                    'status' => $cafe->status ?? 'open',
                    'address' => $cafe->address ?? '',
                    'package_type' => $sub ? ($sub->package->type ?? 'free') : 'none',
                    'package_name' => $sub ? ($sub->package->name ?? '') : '',
                    'package_end_date' => $sub?->end_date,
                ];
            })->values();

            $payments = $paymentsByUser->get($userId, collect());

            // Gói active bất kỳ (quán đầu có gói) — để hiển thị nhanh trạng thái tài khoản.
            $firstWithPkg = $cafeList->firstWhere('package_type', '!=', 'none');
            $firstCafe = $cafes->first();

            $data = $user->toArray();
            $data['cafe_count'] = $cafes->count();
            $data['cafes'] = $cafeList;
            $data['active_package_count'] = $cafeList->where('package_type', '!=', 'none')->count();
            $data['payment_count'] = $payments->count();
            $data['total_paid'] = (float) $payments->sum('amount');
            $data['last_payment_at'] = $payments->max('paid_at');
            // Trường số ít giữ tương thích ngược cho bảng admin cũ.
            $data['package_type'] = $firstWithPkg['package_type'] ?? 'none';
            $data['package_name'] = $firstWithPkg['package_name'] ?? '';
            $data['cafe_name'] = $firstCafe ? $firstCafe->name : null;
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

    public function toggleLock(Request $request, User $user)
    {
        // Không cho admin tự khóa chính mình (tránh tự khóa cửa hệ thống)
        if ((string) $user->id === (string) $request->user()->id) {
            return response()->json(['message' => 'Bạn không thể khóa chính tài khoản của mình.'], 400);
        }

        $newStatus = $user->status === 'active' ? 'locked' : 'active';
        $user->update(['status' => $newStatus]);

        // SECURITY: khóa phải có hiệu lực NGAY — thu hồi toàn bộ token đăng nhập,
        // nếu không user bị khóa vẫn thao tác bình thường tới khi tự đăng xuất.
        if ($newStatus === 'locked') {
            $user->tokens()->delete();
        }

        return response()->json($user);
    }
}
