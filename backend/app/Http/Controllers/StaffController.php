<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ChecksShopAccess;
use App\Http\Controllers\Concerns\EnforcesPackageLimits;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

/**
 * Tài khoản NHÂN VIÊN của một quán.
 *
 * Nhân viên nằm chung collection `users` với chủ quán và admin, phân biệt bằng
 * `role='staff'` + `users.shop_id`. Không tạo collection riêng để dùng lại nguyên
 * Sanctum, đổi mật khẩu, quên mật khẩu, và `EnsureAccountActive` — chủ bấm khóa là
 * token nhân viên đang cầm mất hiệu lực NGAY.
 *
 * Cái giá phải trả: một người làm ở hai quán của cùng chủ phải có hai tài khoản, hai
 * email. Đó là ràng buộc thiết kế có chủ đích, không phải sót.
 *
 * KHÔNG CÓ XÓA. Nhân viên đã bán hàng nằm trong `orders.created_by` / `paid_by`; xóa
 * là bỏ rơi tham chiếu và hóa đơn cũ mất tên người thu. Chỉ khóa (`status='locked'`),
 * đúng quy ước sẵn có của dự án với danh mục, món, topping, quán và bàn.
 */
class StaffController extends Controller
{
    use ChecksShopAccess;
    use EnforcesPackageLimits;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);

        $ds = User::where('shop_id', (string) $shop->id)
            ->where('role', 'staff')
            ->orderBy('created_at', 'asc')
            ->get(['_id', 'full_name', 'email', 'phone', 'status', 'created_at']);

        return response()->json($ds);
    }

    public function store(Request $request, Shop $shop)
    {
        $this->authorizeShop($shop);
        $this->enforcePackageLimit($shop, 'staff', $this->demNhanVien($shop));

        $validated = $request->validate([
            'full_name' => 'required|string|max:255',
            // Email duy nhất TOÀN HỆ THỐNG, không phải chỉ trong quán: nó là tên đăng
            // nhập, và `users` có chỉ mục duy nhất trên nó. Kiểm ở đây để người dùng
            // nhận được thông báo tử tế thay vì lỗi 500 từ tầng CSDL.
            'email'     => ['required', 'email', 'max:255', Rule::unique('mongodb.users', 'email')],
            'phone'     => 'nullable|string|max:20',
            'password'  => 'required|string|min:8',
        ], [
            'email.unique'    => 'Email này đã có người dùng. Chọn email khác.',
            'password.min'    => 'Mật khẩu phải từ 8 ký tự.',
        ]);

        // `role` và `shop_id` đặt CÙNG LÚC, và đây là chỗ duy nhất trong hệ thống tạo
        // ra một nhân viên. Nhờ vậy không có đường nào sinh ra nhân viên không gắn quán
        // — thứ mà NoSQL không có NOT NULL để ép hộ.
        $nv = User::create([
            'full_name' => $validated['full_name'],
            'email'     => strtolower(trim($validated['email'])),
            'phone'     => $validated['phone'] ?? '',
            'password'  => Hash::make($validated['password']),
            'role'      => 'staff',
            'status'    => 'active',
            'shop_id'   => (string) $shop->id,
        ]);

        return response()->json($nv->only(['id', 'full_name', 'email', 'phone', 'status']), 201);
    }

    /** Đổi họ tên / số điện thoại, hoặc khóa & mở khóa. */
    public function update(Request $request, Shop $shop, User $staff)
    {
        $this->authorizeShop($shop);
        $this->laNhanVienCuaQuan($shop, $staff);

        $validated = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'phone'     => 'nullable|string|max:20',
            'status'    => 'sometimes|string|in:active,locked',
        ]);

        $staff->update($validated);

        return response()->json($staff->only(['id', 'full_name', 'email', 'phone', 'status']));
    }

    /**
     * Chủ quán đặt lại mật khẩu cho nhân viên (quên mật khẩu, đổi người trực).
     *
     * KHÔNG hỏi mật khẩu cũ: chủ quán không biết mật khẩu của nhân viên, và cũng
     * không cần biết. Quyền này đến từ việc sở hữu quán, đã kiểm ở authorizeShop.
     */
    public function doiMatKhau(Request $request, Shop $shop, User $staff)
    {
        $this->authorizeShop($shop);
        $this->laNhanVienCuaQuan($shop, $staff);

        $validated = $request->validate(
            ['password' => 'required|string|min:8'],
            ['password.min' => 'Mật khẩu phải từ 8 ký tự.'],
        );

        $staff->update(['password' => Hash::make($validated['password'])]);

        // Token cũ KHÔNG bị thu hồi ở đây. `EnsureAccountActive` chỉ chặn theo
        // `status`, nên muốn đuổi hẳn một phiên đang mở thì phải KHÓA tài khoản. Đổi
        // mật khẩu là để cấp lối vào mới, không phải để đuổi người đang ngồi trong.
        return response()->json(['message' => 'Đã đặt lại mật khẩu.']);
    }

    /** Số nhân viên đang tính vào hạn mức gói. Khóa rồi VẪN tính — xem chú thích dưới. */
    private function demNhanVien(Shop $shop): int
    {
        /*
         * Đếm CẢ nhân viên đã khóa, giống hệt cách món ẩn và bàn ẩn vẫn chiếm suất.
         * Một luật cho cả ba chỗ thì không phải giải thích ngoại lệ khi bị hỏi, và
         * cũng chặn được đường lách "khóa bớt để tạo thêm rồi mở lại".
         */
        return User::where('shop_id', (string) $shop->id)->where('role', 'staff')->count();
    }

    private function laNhanVienCuaQuan(Shop $shop, User $staff): void
    {
        if ($staff->role !== 'staff' || (string) $staff->shop_id !== (string) $shop->id) {
            abort(response()->json(['message' => 'Not found'], 404));
        }
    }
}
