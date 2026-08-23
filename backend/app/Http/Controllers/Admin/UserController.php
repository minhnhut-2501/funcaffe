<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Subscription;
use App\Models\Shop;
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
        // Chi liet ke chu quan. Tai khoan quan tri khong phai khach hang: de lot vao
        // day thi sai so dem nguoi dung, sai bo loc theo goi (admin khong co goi) va
        // con hien ra nut khoa tai khoan.
        // Sắp ở CSDL chứ không sắp sau khi lấy: có phân trang nên sắp phía PHP chỉ
        // đảo được đúng 50 bản ghi của trang hiện tại.
        $users = User::where('role', 'user')
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        $userIds = $users->pluck('_id')->map(fn($id) => (string) $id)->toArray();

        // ĐA QUÁN: mỗi user có nhiều quán, mỗi quán có gói riêng. Gom quán theo user,
        // và gói active theo TỪNG QUÁN (shop_id).
        $shopsByUser = Shop::whereIn('user_id', $userIds)
            ->get()
            ->groupBy(fn($c) => (string) $c->user_id);

        $shopIds = Shop::whereIn('user_id', $userIds)->get()->pluck('id')->map(fn($id) => (string) $id)->toArray();

        $subsByShop = Subscription::whereIn('shop_id', $shopIds)
            ->effective()
            ->with('package')
            ->get()
            ->keyBy(fn($s) => (string) $s->shop_id);

        // Lịch sử chi tiêu: gom SẴN theo user bằng MỘT truy vấn thay vì hỏi lại trong
        // vòng lặp — 50 user/trang mà query trong vòng lặp là 50 lượt đi CSDL.
        // Chỉ tính giao dịch đã thanh toán: pending/failed không phải tiền thật.
        $paymentsByUser = PackagePayment::whereIn('user_id', $userIds)
            ->where('payment_status', 'paid')
            ->get()
            ->groupBy(fn($p) => (string) $p->user_id);

        $result = $users->map(function ($user) use ($shopsByUser, $subsByShop, $paymentsByUser) {
            $userId = (string) $user->_id;
            $shops = $shopsByUser->get($userId, collect());

            $shopList = $shops->map(function ($shop) use ($subsByShop) {
                $sub = $subsByShop->get((string) $shop->id);
                return [
                    'id' => (string) $shop->id,
                    'name' => $shop->name,
                    // open | closed | inactive — quán không xóa được, chỉ đổi trạng thái
                    'status' => $shop->status ?? 'open',
                    'address' => $shop->address ?? '',
                    // 'none' chứ không 'free' — xem chú thích ở ShopController::index.
                    'package_type' => $sub ? ($sub->package->type ?? 'none') : 'none',
                    'package_name' => $sub ? ($sub->package->name ?? '') : '',
                    'package_end_date' => $sub?->end_date,
                ];
            })->values();

            $payments = $paymentsByUser->get($userId, collect());

            // Gói active bất kỳ (quán đầu có gói) — để hiển thị nhanh trạng thái tài khoản.
            $firstWithPkg = $shopList->firstWhere('package_type', '!=', 'none');
            $firstShop = $shops->first();

            $data = $user->toArray();
            $data['shop_count'] = $shops->count();
            $data['shops'] = $shopList;
            $data['active_package_count'] = $shopList->where('package_type', '!=', 'none')->count();
            $data['payment_count'] = $payments->count();
            $data['total_paid'] = (float) $payments->sum('amount');
            $data['last_payment_at'] = $payments->max('paid_at');
            // Trường số ít giữ tương thích ngược cho bảng admin cũ.
            $data['package_type'] = $firstWithPkg['package_type'] ?? 'none';
            $data['package_name'] = $firstWithPkg['package_name'] ?? '';
            $data['shop_name'] = $firstShop ? $firstShop->name : null;
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
        // SECURITY: khong khoa duoc BAT KY tai khoan quan tri nao, khong rieng gi
        // chinh minh. Chan tu khoa chinh minh la chua du: he thong co the co nhieu
        // admin, luc do admin nay khoa duoc admin kia.
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Không thể khóa tài khoản quản trị.'], 403);
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
