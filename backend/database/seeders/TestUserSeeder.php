<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use MongoDB\BSON\ObjectId;

/**
 * Hai tài khoản cố định của hệ thống (1 admin + 1 chủ quán).
 *
 * CHẠY LẠI MỖI LẦN CONTAINER KHỞI ĐỘNG (ProductionSeeder gọi, xem Dockerfile CMD),
 * mà Render free ngủ sau ~15 phút nên nó chạy rất thường xuyên. Vì vậy seeder này
 * phải TUYỆT ĐỐI không phá dữ liệu đang có:
 *   - chỉ TẠO khi thiếu, không bao giờ ghi đè mật khẩu tài khoản đã tồn tại
 *     (người dùng đổi mật khẩu xong mà bị reset ngầm là mất tài khoản);
 *   - không bao giờ XÓA tài khoản chủ quán — xóa là toàn bộ quán/thực đơn/đơn hàng
 *     trỏ tới user_id đó thành mồ côi, dữ liệu còn nguyên trong CSDL nhưng không
 *     tài khoản nào đọc được nữa.
 */
class TestUserSeeder extends Seeder
{
    /** Mật khẩu khởi tạo — khớp ràng buộc min:8 của AuthController. */
    private const PASSWORD = '12345678';

    private const ADMIN_ID = '6a3910511846951d38041ca8';
    private const ADMIN_EMAIL = 'adminfuncafe@gmail.com';

    /** _id cố định: các quán demo tham chiếu user_id này (xem DemoSeeder). */
    private const OWNER_ID = '6a3910511846951d38041ca7';
    private const OWNER_EMAIL = 'nphec4007@gmail.com';

    public function run(): void
    {
        // Dọn các tài khoản demo của bản cũ. Chỉ xóa đúng những email này —
        // chúng không còn nằm trong thiết kế và không sở hữu dữ liệu nào.
        User::whereIn('email', ['admin@funcafe.vn', 'user@funcafe.vn'])->delete();

        $this->ensure(self::ADMIN_ID, self::ADMIN_EMAIL, 'Admin FunCafe', 'admin', '0900000000');
        $this->ensure(self::OWNER_ID, self::OWNER_EMAIL, 'Nguyễn Minh Nhựt', 'user', '0901234567');
    }

    private function ensure(string $id, string $email, string $name, string $role, string $phone): void
    {
        $user = User::where('email', $email)->first();

        if ($user) {
            // Đã có: KHÔNG đụng gì. _id lệch thì chỉ báo, không xóa — dữ liệu của
            // tài khoản này quý hơn việc _id đẹp.
            if ((string) $user->getKey() !== $id) {
                $this->command->warn("{$email}: _id là {$user->getKey()} (mong đợi {$id}) — giữ nguyên, không xóa.");
            }

            return;
        }

        User::create([
            '_id' => new ObjectId($id),
            'full_name' => $name,
            'email' => $email,
            'password' => Hash::make(self::PASSWORD),
            'phone' => $phone,
            'role' => $role,
            'status' => 'active',
        ]);

        $this->command->info("Đã tạo {$role}: {$email} / " . self::PASSWORD);
    }
}
