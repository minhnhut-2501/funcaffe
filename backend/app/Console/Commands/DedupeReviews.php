<?php

namespace App\Console\Commands;

use App\Models\Review;
use Illuminate\Console\Command;

/**
 * Gộp các đánh giá trùng của cùng một tài khoản.
 *
 * Trước đây khóa duy nhất của đánh giá là cặp (user_id + shop_id), nên chủ quán
 * có 3 quán viết được 3 đánh giá và cả 3 cùng lên trang chủ. Nay khóa là user_id
 * (xem ReviewController@store), nhưng dữ liệu cũ đã dính rồi — lệnh này dọn.
 *
 * Cách gộp: giữ bản MỚI NHẤT, các bản còn lại được đẩy vào `history` của nó theo
 * đúng định dạng written_at / replaced_at mà store() đang dùng, rồi xóa đi. Không
 * bản nào bị mất nội dung, chỉ đổi chỗ.
 *
 * LỆNH NÀY XÓA BẢN GHI. Mặc định chạy thử (--dry-run), phải truyền --force mới
 * thật sự ghi.
 */
class DedupeReviews extends Command
{
    protected $signature = 'reviews:dedupe
                            {--force : Thực sự ghi và xóa. Không có cờ này thì chỉ in ra dự định.}';

    protected $description = 'Gộp đánh giá trùng của cùng một tài khoản, giữ bản mới nhất';

    public function handle(): int
    {
        $apply = (bool) $this->option('force');

        if (!$apply) {
            $this->warn('CHẠY THỬ — không ghi gì cả. Thêm --force để thực hiện thật.');
        } else {
            $this->warn('CHẠY THẬT — sẽ xóa bản ghi.');
        }
        $this->newLine();

        // Gom trong PHP thay vì aggregate: số đánh giá của một sản phẩm SaaS nhỏ nằm
        // ở mức vài nghìn, tải hết vào bộ nhớ rẻ hơn nhiều so với việc phải bảo trì
        // một pipeline aggregate riêng cho MongoDB.
        $groups = Review::all()->groupBy(fn ($r) => (string) $r->user_id);

        $dupGroups = $groups->filter(fn ($g) => $g->count() > 1);

        if ($dupGroups->isEmpty()) {
            $this->info('Không có tài khoản nào có nhiều hơn một đánh giá. Không cần làm gì.');
            $this->createIndex($apply);
            return self::SUCCESS;
        }

        $this->line("Tìm thấy {$dupGroups->count()} tài khoản có đánh giá trùng:");
        $this->newLine();

        $totalRemoved = 0;

        foreach ($dupGroups as $userId => $reviews) {
            // Mới nhất = updated_at (rơi về created_at nếu chưa từng sửa) lớn nhất.
            $sorted = $reviews->sortByDesc(fn ($r) => $r->updated_at ?? $r->created_at)->values();
            $keep = $sorted->first();
            $drop = $sorted->slice(1);

            $name = $keep->user?->full_name ?? $userId;
            $this->line("  {$name}: giữ 1, gộp {$drop->count()} bản vào lịch sử");

            foreach ($drop as $old) {
                $this->line(sprintf(
                    '      - %d sao · %s',
                    (int) $old->rating,
                    \Illuminate\Support\Str::limit((string) ($old->title ?: $old->comment ?: '(trống)'), 60),
                ));
            }

            if (!$apply) {
                $totalRemoved += $drop->count();
                continue;
            }

            $history = (array) ($keep->history ?? []);
            foreach ($drop as $old) {
                $history[] = [
                    'rating'      => (int) $old->rating,
                    'title'       => $old->title,
                    'comment'     => $old->comment,
                    'package_id'  => $old->package_id,
                    'written_at'  => optional($old->updated_at ?? $old->created_at)->toIso8601String(),
                    'replaced_at' => now()->toIso8601String(),
                ];
            }

            // Bản cũ nhất nằm trước, khớp thứ tự mà store() sinh ra.
            usort($history, fn ($a, $b) => strcmp((string) ($a['written_at'] ?? ''), (string) ($b['written_at'] ?? '')));
            $keep->update(['history' => array_slice($history, -20)]);

            foreach ($drop as $old) {
                $old->delete();
                $totalRemoved++;
            }
        }

        $this->newLine();
        if ($apply) {
            $this->info("Xong: đã xóa {$totalRemoved} bản ghi thừa, nội dung nằm trong 'history' của bản được giữ.");
        } else {
            $this->info("Chạy thật sẽ xóa {$totalRemoved} bản ghi. Chưa có gì thay đổi.");
        }

        $this->createIndex($apply);

        return self::SUCCESS;
    }

    /**
     * Ràng buộc "một tài khoản một đánh giá" phải nằm ở CSDL chứ không chỉ ở
     * controller — nếu không, hai request gửi cùng lúc vẫn tạo được hai bản ghi.
     * Chỉ tạo được sau khi đã hết trùng, nên bước này đứng cuối.
     */
    private function createIndex(bool $apply): void
    {
        $this->newLine();
        if (!$apply) {
            $this->line('Chạy thật sẽ tạo thêm unique index trên reviews.user_id.');
            return;
        }

        try {
            Review::raw(fn ($collection) => $collection->createIndex(
                ['user_id' => 1],
                ['unique' => true, 'name' => 'uniq_user_review'],
            ));
            $this->info('Đã tạo unique index reviews.user_id (uniq_user_review).');
        } catch (\Throwable $e) {
            $this->error('Không tạo được unique index: ' . $e->getMessage());
        }
    }
}
