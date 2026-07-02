<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use MongoDB\BSON\ObjectId;

class TestUserSeeder extends Seeder
{
    public function run(): void
    {
        // Only create if not exists
        if (!User::where('email', 'admin@funcafe.vn')->exists()) {
            User::create([
                'full_name' => 'Admin FunCafe',
                'email' => 'admin@funcafe.vn',
                'password' => Hash::make('123456'),
                'phone' => '0900000000',
                'role' => 'admin',
                'status' => 'active',
            ]);
            $this->command->info('Created admin account: admin@funcafe.vn / 123456');
        }

        // Dọn tài khoản demo cũ (nếu còn) để chỉ giữ đúng 2 tài khoản mong muốn.
        User::where('email', 'user@funcafe.vn')->delete();

        // _id cố định = user_id của quán demo (seed-data/cafes.json) để
        // quán + thực đơn + bàn tự thuộc về tài khoản này.
        $ownerId = '6a3910511846951d38041ca7';
        $owner = User::where('email', 'nphec4007@gmail.com')->first();

        // Nếu bản cũ tồn tại nhưng _id không đúng (lần seed trước tạo _id ngẫu nhiên),
        // xóa đi để tạo lại với _id chuẩn (Mongo không cho đổi _id).
        if ($owner && (string) $owner->getKey() !== $ownerId) {
            $owner->delete();
            $owner = null;
        }

        if (!$owner) {
            User::create([
                '_id' => new ObjectId($ownerId),
                'full_name' => 'Nguyễn Minh Nhựt',
                'email' => 'nphec4007@gmail.com',
                'password' => Hash::make('123456'),
                'phone' => '0901234567',
                'role' => 'user',
                'status' => 'active',
            ]);
            $this->command->info('Created user account: nphec4007@gmail.com / 123456');
        }
    }
}
