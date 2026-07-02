<?php

namespace App\Http\Controllers;

use App\Models\User;
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
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'phone' => 'nullable|string|max:20',
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

    public function updateProfile(Request $request)
    {
        $validated = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:20',
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

        return response()->json(['message' => 'Đã đổi mật khẩu thành công.']);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['message' => 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.']);
        }

        $token = bin2hex(random_bytes(32));

        $user->update(['reset_token' => $token, 'reset_token_expires_at' => now()->addHours(1)]);

        $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000'));
        $resetUrl = "{$frontendUrl}/reset-password?token={$token}&email=" . urlencode($user->email);

        // Gửi email thật nếu SMTP đã được cấu hình (MAIL_MAILER=smtp + có App Password).
        // Nếu chưa, ghi link vào log để vẫn test được luồng (không làm hỏng request).
        $smtpPass = config('mail.mailers.smtp.password');
        $mailReady = config('mail.default') === 'smtp'
            && !empty($smtpPass)
            && $smtpPass !== 'your-gmail-app-password';

        if ($mailReady) {
            try {
                $body = "Xin chào,\n\n"
                    . "Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản FunCafe ({$user->email}).\n"
                    . "Nhấn vào liên kết bên dưới để đặt lại (liên kết hết hạn sau 1 giờ):\n\n"
                    . "{$resetUrl}\n\n"
                    . "Nếu không phải bạn, vui lòng bỏ qua email này.\n\n— FunCafe";
                Mail::raw($body, function ($m) use ($user) {
                    $m->to($user->email)->subject('Đặt lại mật khẩu FunCafe');
                });
            } catch (\Throwable $e) {
                Log::warning("Gửi email reset thất bại ({$user->email}): " . $e->getMessage());
                Log::info("Reset link for {$user->email}: {$resetUrl}");
            }
        } else {
            Log::info("[MAIL chưa cấu hình SMTP] Reset link for {$user->email}: {$resetUrl}");
        }

        return response()->json(['message' => 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.']);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => 'required|string|min:8',
            'password_confirmation' => 'required|string|same:password',
        ]);

        $user = User::where('email', $validated['email'])
            ->where('reset_token', $validated['token'])
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

        return response()->json(['message' => 'Mật khẩu đã được đặt lại thành công.']);
    }
}
