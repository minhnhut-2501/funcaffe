<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Throwable;

/**
 * Lớp cơ sở cho các bài kiểm thử cần MongoDB thật.
 *
 * Dữ liệu của FunCafe nằm hết ở Mongo và không đi qua migration, nên không có cách
 * nào dựng lược đồ trong bộ nhớ như với SQL. Cách làm ở đây: ghi thật vào một CSDL
 * RIÊNG (`funcafe_testing`, đặt ở phpunit.xml) rồi dọn sạch sau mỗi bài.
 *
 * Máy không chạy Mongo thì BỎ QUA thay vì báo lỗi — người sửa giao diện không nên
 * bị chặn bởi một dịch vụ họ không đụng tới. Các bài này chạy trên máy phát triển và
 * trên môi trường triển khai, nơi Mongo luôn có.
 */
abstract class MongoTestCase extends TestCase
{
    /** Các collection sẽ được dọn trước và sau mỗi bài. */
    protected array $collections = [];

    protected function setUp(): void
    {
        parent::setUp();

        $database = config('database.connections.mongodb.database');
        if ($database === 'funcafe') {
            $this->fail('Kiểm thử đang trỏ vào CSDL thật "funcafe". Kiểm tra MONGODB_DATABASE trong phpunit.xml.');
        }

        try {
            DB::connection('mongodb')->getMongoDB()->command(['ping' => 1]);
        } catch (Throwable $e) {
            $this->markTestSkipped('Không kết nối được MongoDB: ' . $e->getMessage());
        }

        // Bộ đếm tần suất nằm trong cache. Không dọn thì các bài NỐI ĐUÔI nhau trên
        // cùng một bộ đếm (khách chưa đăng nhập đều đếm theo IP 127.0.0.1): bài chạy
        // sau vô cớ nhận 429 vì bài chạy trước đã tiêu hết lượt. Cache lúc kiểm thử
        // là 'array' (xem phpunit.xml) nên dọn ở đây không đụng gì thật.
        Cache::flush();

        $this->wipe();
    }

    protected function tearDown(): void
    {
        try {
            $this->wipe();
        } catch (Throwable) {
            // Dọn dẹp hỏng không được che mất lỗi thật của bài kiểm thử.
        }

        parent::tearDown();
    }

    private function wipe(): void
    {
        foreach ($this->collections as $collection) {
            DB::connection('mongodb')->getCollection($collection)->deleteMany([]);
        }
    }
}
