<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Tạo chỉ mục cho các collection MongoDB.
 *
 * Vì sao cần một lệnh riêng: dữ liệu thật của FunCafe nằm hết ở MongoDB, mà Mongo
 * KHÔNG đi qua migration của Laravel (thư mục database/migrations chỉ chứa mấy bảng
 * sqlite cho token Sanctum và cache). Không có chỗ nào khác để khai báo chỉ mục.
 *
 * Hai nhóm chỉ mục, hai mục đích khác nhau:
 *
 *  1. DUY NHẤT (unique) — chốt chặn cuối cho mã đơn / mã hóa đơn / mã giao dịch.
 *     Cách sinh mã hiện tại là `count() + 1` rồi dò tới số chưa dùng; vòng dò đó chỉ
 *     THU HẸP khe hở chứ không đóng được: hai request song song cùng đọc count, cùng
 *     thấy mã chưa tồn tại, rồi cùng ghi. Chỉ có ràng buộc ở tầng CSDL mới chặn thật.
 *
 *  2. TRA CỨU — các truy vấn chạy liên tục đều lọc theo cafe_id kèm status hoặc
 *     khoảng ngày. Thiếu chỉ mục thì mỗi lần là một lượt quét toàn bộ collection.
 *
 * Chạy được nhiều lần: createIndex bỏ qua chỉ mục đã tồn tại y hệt.
 * Gọi trong Dockerfile ngay sau `migrate`.
 */
class CreateMongoIndexes extends Command
{
    protected $signature = 'db:indexes';
    protected $description = 'Tạo (hoặc bổ sung) chỉ mục cho các collection MongoDB';

    /**
     * @var array<string, array<int, array{keys: array<string,int>, options?: array<string,mixed>}>>
     */
    private const INDEXES = [
        'orders' => [
            // Màn hình Bán hàng hỏi đơn đang phục vụ; trang Hóa đơn hỏi đơn đã trả tiền.
            ['keys' => ['cafe_id' => 1, 'status' => 1]],
            // Doanh thu và biểu đồ lọc theo ngày thanh toán, mới nhất trước.
            ['keys' => ['cafe_id' => 1, 'paid_at' => -1]],
            [
                'keys' => ['cafe_id' => 1, 'code' => 1],
                'options' => ['unique' => true, 'name' => 'uniq_cafe_order_code'],
            ],
            [
                'keys' => ['cafe_id' => 1, 'invoice_code' => 1],
                'options' => [
                    'unique' => true,
                    'name' => 'uniq_cafe_invoice_code',
                    // partialFilterExpression là BẮT BUỘC ở đây: đơn chưa thanh toán
                    // không có invoice_code, mà Mongo coi "thiếu trường" là một giá
                    // trị — unique thường sẽ chỉ cho phép ĐÚNG MỘT đơn chưa thanh toán
                    // trên toàn hệ thống.
                    'partialFilterExpression' => ['invoice_code' => ['$type' => 'string']],
                ],
            ],
        ],
        'order_details' => [
            ['keys' => ['order_id' => 1]],
        ],
        'order_detail_toppings' => [
            ['keys' => ['order_detail_id' => 1]],
        ],
        'package_payments' => [
            [
                'keys' => ['transaction_code' => 1],
                'options' => ['unique' => true, 'name' => 'uniq_transaction_code'],
            ],
            // Callback của cổng tra đơn theo mã đã gửi đi (MoMo dùng đuôi ngẫu nhiên).
            ['keys' => ['gateway_order_id' => 1]],
            ['keys' => ['cafe_id' => 1, 'payment_status' => 1]],
            ['keys' => ['user_id' => 1, 'payment_status' => 1]],
        ],
        'subscriptions' => [
            // Mọi chốt chặn gói (CheckSubscription, EnforcesPackageLimits, RequiresAI)
            // đều lọc đúng bộ ba này.
            ['keys' => ['cafe_id' => 1, 'status' => 1, 'end_date' => -1]],
        ],
        'cafes' => [
            ['keys' => ['user_id' => 1]],
        ],
        'items'      => [['keys' => ['cafe_id' => 1]]],
        'categories' => [['keys' => ['cafe_id' => 1]]],
        'toppings'   => [['keys' => ['cafe_id' => 1]]],
        // LƯU Ý: collection của model CafeTable tên là 'tables', không phải 'cafe_tables'.
        'tables'     => [['keys' => ['cafe_id' => 1]]],
        'item_prices'   => [['keys' => ['item_id' => 1]]],
        'item_toppings' => [['keys' => ['item_id' => 1]]],
        'reviews' => [
            ['keys' => ['user_id' => 1]],
            ['keys' => ['status' => 1, 'created_at' => -1]],
        ],
        'users' => [
            ['keys' => ['email' => 1], 'options' => ['unique' => true, 'name' => 'uniq_email']],
            ['keys' => ['reset_token' => 1]],
        ],
        'contact_messages' => [
            ['keys' => ['created_at' => -1]],
        ],
    ];

    public function handle(): int
    {
        $db = DB::connection('mongodb');
        $created = 0;
        $failed = 0;

        foreach (self::INDEXES as $collection => $indexes) {
            foreach ($indexes as $index) {
                $options = $index['options'] ?? [];
                $label = $collection . ' ' . json_encode($index['keys']);

                try {
                    $db->getCollection($collection)->createIndex($index['keys'], $options);
                    $this->line("  ok   {$label}");
                    $created++;
                } catch (Throwable $e) {
                    // Chỉ mục duy nhất sẽ THẤT BẠI nếu dữ liệu hiện có đã trùng. Đó là
                    // thông tin hữu ích chứ không phải lý do dừng cả lệnh: báo ra rồi
                    // đi tiếp, để các chỉ mục còn lại vẫn được tạo.
                    $this->warn("  FAIL {$label}: " . $e->getMessage());
                    $failed++;
                }
            }
        }

        $this->info("Xong: {$created} chỉ mục, {$failed} lỗi.");

        if ($failed > 0) {
            $this->warn('Chỉ mục duy nhất báo lỗi thường là do dữ liệu cũ đã có bản ghi trùng — cần dọn trùng rồi chạy lại.');
        }

        // Luôn trả 0: Dockerfile chạy lệnh này lúc khởi động, không được để một chỉ
        // mục hỏng chặn cả việc lên của ứng dụng.
        return self::SUCCESS;
    }
}
