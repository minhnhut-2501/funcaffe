<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

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

        if (!User::where('email', 'user@funcafe.vn')->exists()) {
            User::create([
                'full_name' => 'Nguyễn Minh Nhựt',
                'email' => 'user@funcafe.vn',
                'password' => Hash::make('123456'),
                'phone' => '0901234567',
                'role' => 'user',
                'status' => 'active',
            ]);
            $this->command->info('Created user account: user@funcafe.vn / 123456');
        }
    }
}
