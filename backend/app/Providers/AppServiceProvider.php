<?php

namespace App\Providers;

use App\Models\PersonalAccessToken;
use App\Support\CauHinhMail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        $this->dinhNghiaGioiHanTanSuat();
        $this->canhBaoCauHinhTrienKhai();
        $this->dinhTuyenThuTraLoi();
    }

    /**
     * Mọi thư đi ra đều mang Reply-To trỏ về hòm thư có người đọc.
     *
     * Thư gửi từ tên miền đã xác thực ở Resend (`no-reply@funcafe.pro`) — hòm đó không
     * ai mở. Đặt ở đây thay vì đi sửa từng Mailable vì cái bẫy nằm ở chỗ ngược lại:
     * thêm một nơi gửi thư mới mà quên gắn Reply-To thì không có gì báo, chỉ có thư
     * của khách lặng lẽ đi vào hư không.
     */
    private function dinhTuyenThuTraLoi(): void
    {
        $diaChi = config('mail.reply_to.address');

        if (!empty($diaChi)) {
            Mail::alwaysReplyTo($diaChi, (string) config('mail.reply_to.name'));
        }
    }

    /**
     * Kêu to khi bản đã triển khai đang chạy với cấu hình chỉ hợp cho máy phát triển.
     *
     * Bốn thứ dưới đây đều KHÔNG làm hỏng gì ngay — ứng dụng chạy bình thường, không
     * báo lỗi nào — nên rất dễ lên mạng rồi vẫn còn nguyên. Mỗi cái là một cửa mở:
     *
     *  · `APP_DEBUG=true` in ra đường dẫn tệp, đoạn mã và **toàn bộ biến môi trường**
     *    trên trang lỗi. Một lỗi 500 bất kỳ là lộ khóa cổng thanh toán và chuỗi kết
     *    nối CSDL cho bất kỳ ai gây ra được lỗi đó.
     *  · CORS `*` cho phép **mọi trang web** gọi API này bằng token của người dùng
     *    đang đăng nhập.
     *  · `APP_KEY` rỗng thì mọi thứ Laravel mã hóa đều không đáng tin.
     *  · Cấu hình thư thiếu thì thư đặt lại mật khẩu và thư trả lời khách chui vào
     *    tệp log, còn giao diện vẫn báo "đã gửi".
     *
     * Chỉ ghi log, không chặn khởi động: dựng được nhưng không vào được thì còn tệ
     * hơn, nhất là trong buổi bảo vệ.
     */
    private function canhBaoCauHinhTrienKhai(): void
    {
        if (!app()->isProduction()) {
            return;
        }

        if (config('app.debug')) {
            Log::warning('[TRIỂN KHAI] APP_DEBUG đang BẬT trên production — trang lỗi sẽ lộ biến môi trường (khóa cổng thanh toán, chuỗi kết nối CSDL). Đặt APP_DEBUG=false.');
        }

        if (in_array('*', (array) config('cors.allowed_origins'), true)) {
            Log::warning('[TRIỂN KHAI] CORS đang mở cho MỌI tên miền — đặt CORS_ALLOWED_ORIGINS = địa chỉ frontend thật.');
        }

        if (empty(config('app.key'))) {
            Log::warning('[TRIỂN KHAI] APP_KEY đang rỗng — chạy `php artisan key:generate`.');
        }

        // Kêu NGAY LÚC KHỞI ĐỘNG, không đợi ai bấm "Quên mật khẩu" rồi mới biết. Bản
        // triển khai từng chạy nhiều tuần với mailer `log` mà không ai hay: thư ghi vào
        // tệp, giao diện báo gửi xong, không một dòng lỗi nào. Chốt chặn ở
        // Admin\ContactController chỉ nói khi admin bấm trả lời — quá muộn và quá hẹp.
        if ($lyDo = CauHinhMail::lyDoChuaSanSang()) {
            Log::warning("[TRIỂN KHAI] Máy chủ KHÔNG gửi được thư ra ngoài: {$lyDo}");
        }
    }

    /**
     * Trần tần suất cho toàn bộ /api (bật ở bootstrap/app.php qua `throttleApi()`).
     *
     * 300 lượt/phút là RỘNG so với dùng thật: một màn hình bán hàng nặng nhất cũng chỉ
     * gọi chừng mười lượt mỗi lần mở, còn quán đông khách thì vài lượt mỗi giây là
     * cùng. Con số này không nhắm vào người dùng thật — nó chặn vòng lặp tự động, thứ
     * đi nhanh hơn hai bậc độ lớn.
     *
     * Đếm theo TÀI KHOẢN khi đã đăng nhập, theo địa chỉ IP khi chưa. Đếm theo IP cho
     * cả hai thì mấy máy bán hàng của cùng một quán ngồi sau một đường mạng sẽ ăn
     * chung một trần — quán càng đông càng dễ bị chặn, đúng lúc không nên bị chặn.
     *
     * Các endpoint nhạy cảm vẫn giữ throttle riêng chặt hơn (đăng nhập 10/phút, gửi
     * liên hệ 5/phút…); hai lớp cộng lại, lớp nào chặt hơn thì lớp đó chạm trước.
     */
    private function dinhNghiaGioiHanTanSuat(): void
    {
        RateLimiter::for('api', function (Request $request) {
            // PHẢI hỏi thẳng guard 'sanctum': middleware throttle chạy TRƯỚC
            // `auth:sanctum`, lúc đó `$request->user()` (guard mặc định) còn null nên
            // mọi lượt gọi sẽ bị đếm theo IP — đúng cái nhược điểm nói ở trên.
            $id = $request->user('sanctum')?->getAuthIdentifier();

            return Limit::perMinute(300)->by($id ? 'u:' . $id : 'ip:' . $request->ip());
        });

        $this->gioiHanTroLyAi();
    }

    /**
     * Trần riêng cho trợ lý AI tư vấn — tuyến DUY NHẤT gọi được mà không cần đăng nhập.
     *
     * Ba lớp, mỗi lớp chặn một kiểu hỏng khác nhau:
     *
     *  · theo PHÚT   — chặn người bấm liên tục. Hỏi rồi đọc câu trả lời mất vài chục
     *                  giây, nên vài lượt mỗi phút là quá đủ cho người dùng thật.
     *  · theo NGÀY   — chặn kiểu rỉ rả: đi chậm hơn trần phút nhưng chạy suốt đêm.
     *  · TOÀN HỆ THỐNG — thứ quan trọng nhất. Hai lớp trên đếm theo từng khách, mà
     *                  hạn ngạch Gemini bậc miễn phí thì tính trên CẢ KHÓA. Không có
     *                  trần chung thì mỗi khách đều trong giới hạn nhưng cộng lại vẫn
     *                  đốt sạch quota, và người mất là chủ quán trả tiền gói Pro Max.
     *
     * Trần chung cố ý đặt thấp hơn hẳn hạn ngạch Gemini để luôn còn phần cho tuyến
     * trả phí. Chỉnh qua env khi cần nới tay (ví dụ hôm demo).
     */
    private function gioiHanTroLyAi(): void
    {
        RateLimiter::for('ai-tu-van', function (Request $request) {
            // Khách chưa đăng nhập thì chỉ có IP để bám. Phải có trustProxies
            // (bootstrap/app.php), nếu không mọi khách dùng chung một rổ.
            $khoa = $request->user('sanctum')?->getAuthIdentifier() ?? $request->ip();

            return [
                Limit::perMinute((int) config('funcafe.ai_moi_phut'))->by('ai-phut:' . $khoa),
                Limit::perDay((int) config('funcafe.ai_moi_ngay'))->by('ai-ngay:' . $khoa),
                Limit::perDay((int) config('funcafe.ai_chung_moi_ngay'))->by('ai-chung'),
            ];
        });
    }
}
