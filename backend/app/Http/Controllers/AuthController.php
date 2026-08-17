<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Rules\SoDienThoaiVN;
use App\Support\CauHinhMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'full_name' => 'required|string|max:255',
            // PHẢI ghi rõ connection 'mongodb'. Connection mặc định của ứng dụng là
            // sqlite (chỉ để chứa bảng token của Sanctum), nên 'unique:users,email'
            // sẽ dò trong bảng users RỖNG bên sqlite và luôn cho qua — đã từng tạo
            // được 2 tài khoản trùng email.
            'email' => 'required|string|email|max:255|unique:mongodb.users,email',
            'password' => 'required|string|min:8',
            // Cùng luật với ô nhập ở giao diện — xem App\Rules\SoDienThoaiVN.
            'phone' => ['nullable', 'string', 'max:20', new SoDienThoaiVN()],
        ], [
            // Thông báo tiếng Việt: các lỗi này hiện thẳng lên form đăng ký.
            'full_name.required' => 'Vui lòng nhập họ tên.',
            'email.required'     => 'Vui lòng nhập email.',
            'email.email'        => 'Email không đúng định dạng.',
            'email.unique'       => 'Email này đã được đăng ký. Bạn hãy đăng nhập hoặc dùng email khác.',
            'password.required'  => 'Vui lòng nhập mật khẩu.',
            'password.min'       => 'Mật khẩu phải có ít nhất 8 ký tự.',
            'phone.max'          => 'Số điện thoại quá dài.',
        ]);

        $user = User::create([
            'full_name' => $validated['full_name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? '',
            'role' => 'user',
            'status' => 'active',
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Thông tin đăng nhập không chính xác.'],
            ]);
        }

        // BUG-03 FIX: Chặn đăng nhập khi tài khoản bị khóa
        if ($user->status === 'locked') {
            throw ValidationException::withMessages([
                'email' => ['Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.'],
            ]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Đã đăng xuất.']);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }

    /**
     * Sửa hồ sơ cá nhân — CÓ CHỦ Ý không cho đổi email.
     *
     * Email là tên đăng nhập, là địa chỉ nhận liên kết đặt lại mật khẩu, và là khóa
     * đối chiếu trong lịch sử giao dịch gói. Cho đổi tại đây thì phải kèm bước xác
     * minh địa chỉ mới (gõ sai một ký tự là mất luôn đường vào tài khoản) — việc đó
     * chưa làm, nên chặn hẳn thay vì làm nửa vời. Ô email ở giao diện bị vô hiệu hóa
     * và ghi rõ "không thể đổi"; ở đây `email` không nằm trong danh sách nên có gửi
     * lên cũng bị bỏ, không âm thầm ghi vào CSDL.
     */
    public function updateProfile(Request $request)
    {
        $validated = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'phone' => ['nullable', 'string', 'max:20', new SoDienThoaiVN()],
            'avatar' => 'nullable|string',
        ]);

        $user = $request->user();
        $user->update($validated);

        return response()->json($user);
    }

    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8',
            'confirm_password' => 'required|string|same:new_password',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Mật khẩu hiện tại không chính xác.'],
            ]);
        }

        $user->update(['password' => Hash::make($validated['new_password'])]);

        // SECURITY: thu hồi các token khác (đăng nhập trên thiết bị khác),
        // giữ lại token hiện tại để user không bị văng ra ngay sau khi đổi.
        $currentTokenId = $request->user()->currentAccessToken()->getKey();
        $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        return response()->json(['message' => 'Đã đổi mật khẩu thành công.']);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['message' => 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.']);
        }

        // Token gửi qua email là bản THÔ; CSDL chỉ giữ bản BĂM.
        // Ai đọc được dữ liệu (bản sao lưu, tài khoản đọc CSDL, kết xuất chẩn đoán)
        // cũng không dựng ngược lại được liên kết đặt lại mật khẩu.
        $token = bin2hex(random_bytes(32));

        $user->update([
            'reset_token' => hash('sha256', $token),
            'reset_token_expires_at' => now()->addHours(1),
        ]);

        $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000'));
        $resetUrl = "{$frontendUrl}/reset-password?token={$token}&email=" . urlencode($user->email);

        // Gửi email thật nếu SMTP đã được cấu hình (MAIL_MAILER=smtp + có App Password).
        // Nếu chưa, ghi link vào log để vẫn test được luồng (không làm hỏng request).
        $lyDo = CauHinhMail::lyDoChuaSanSang();

        if ($lyDo === null) {
            try {
                $body = "Xin chào,\n\n"
                    . "Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản FunCafe ({$user->email}).\n"
                    . "Nhấn vào liên kết bên dưới để đặt lại (liên kết hết hạn sau 1 giờ):\n\n"
                    . "{$resetUrl}\n\n"
                    . "Nếu không phải bạn, vui lòng bỏ qua email này.\n\n— FunCafe";
                Mail::raw($body, function ($m) use ($user) {
                    $m->to($user->email)->subject('Đặt lại mật khẩu FunCafe');
                });

                // Gửi xong vẫn ghi liên kết ra log KHI ĐANG Ở MÁY LẬP TRÌNH: ở đó thư đi
                // vào mailer giả (`array`) chứ không tới hộp thư nào, nên đây là đường
                // duy nhất để người lập trình và bộ kiểm thử đi tiếp bước đặt lại mật
                // khẩu. Hàm dưới tự chặn việc ghi token ở production.
                if (app()->environment('local', 'testing')) {
                    $this->logResetUrlForDevelopment($user->email, $resetUrl);
                }
            } catch (\Throwable $e) {
                Log::warning("Gửi email reset thất bại ({$user->email}): " . $e->getMessage());
                $this->logResetUrlForDevelopment($user->email, $resetUrl);
            }
        } else {
            // Người dùng vẫn nhận câu trả lời mơ hồ (không được để lộ email nào có tài
            // khoản), nên đây là DẤU VẾT DUY NHẤT cho biết vì sao thư không tới nơi.
            // Nói thẳng biến môi trường còn thiếu, thay vì "MAIL chưa cấu hình SMTP".
            Log::error("[MAIL] Không gửi được thư đặt lại mật khẩu: {$lyDo}");
            $this->logResetUrlForDevelopment($user->email, $resetUrl, '[MAIL chưa cấu hình SMTP] ');
        }

        return response()->json(['message' => 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.']);
    }

    /**
     * Ghi liên kết đặt lại mật khẩu vào log — CHỈ Ở MÔI TRƯỜNG PHÁT TRIỂN.
     *
     * Liên kết chứa token thô: ai đọc được log (bảng điều khiển Render,
     * storage/logs/laravel.log) là chiếm được tài khoản mà không cần mật khẩu cũ.
     * Ở local thì đây là cách duy nhất thử luồng khi chưa cấu hình SMTP; trên
     * production chỉ ghi lại việc gửi thất bại, không kèm token.
     */
    private function logResetUrlForDevelopment(string $email, string $resetUrl, string $prefix = ''): void
    {
        if (app()->environment('local', 'testing')) {
            Log::info("{$prefix}Reset link for {$email}: {$resetUrl}");
            return;
        }

        Log::warning("{$prefix}Không gửi được email đặt lại mật khẩu cho {$email}. Liên kết KHÔNG được ghi log vì lý do bảo mật.");
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => 'required|string|min:8',
            'password_confirmation' => 'required|string|same:password',
        ]);

        // So khớp bằng bản băm — xem forgotPassword().
        $user = User::where('email', $validated['email'])
            ->where('reset_token', hash('sha256', $validated['token']))
            ->where('reset_token_expires_at', '>', now())
            ->first();

        if (!$user) {
            return response()->json(['message' => 'Liên kết không hợp lệ hoặc đã hết hạn.'], 400);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
            'reset_token' => null,
            'reset_token_expires_at' => null,
        ]);

        // SECURITY: thu hồi TOÀN BỘ token đăng nhập cũ — reset mật khẩu thường do
        // nghi ngờ lộ tài khoản, không được để phiên cũ (kẻ xấu) tiếp tục sống.
        $user->tokens()->delete();

        return response()->json(['message' => 'Mật khẩu đã được đặt lại thành công.']);
    }
}
