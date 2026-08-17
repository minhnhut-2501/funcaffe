<?php

namespace App\Support;

/**
 * Máy chủ này có thật sự gửi được thư ra ngoài không?
 *
 * VÌ SAO CẦN MỘT CHỖ RIÊNG: `config/mail.php` khai `'default' => env('MAIL_MAILER', 'log')`.
 * Thiếu biến môi trường thì Laravel KHÔNG báo lỗi — nó lặng lẽ đổi sang mailer `log`,
 * ghi nguyên bức thư vào `storage/logs` rồi trả về như đã gửi xong. Bản triển khai trên
 * Render từng chạy đúng như vậy: quên mật khẩu báo "Nếu email tồn tại...", admin bấm
 * trả lời thì báo "Đã gửi email trả lời tới ...", còn hộp thư người nhận trống trơn.
 * Không một dòng lỗi nào, nên không có gì để mà đi tìm.
 *
 * Hai nơi gửi thư (đặt lại mật khẩu, admin trả lời liên hệ) trước đây mỗi nơi tự kiểm
 * một kiểu. Gom về đây để chúng không thể lệch nhau nữa.
 */
class CauHinhMail
{
    /** Giá trị mẫu trong .env.example — có mà như không. */
    private const MAT_KHAU_MAU = 'your-gmail-app-password';

    public static function sanSang(): bool
    {
        return self::lyDoChuaSanSang() === null;
    }

    /**
     * Vì sao chưa gửi được — câu chữ dành cho NGƯỜI TRỰC VẬN HÀNH đọc trong log hoặc
     * trên màn hình quản trị, nên nói thẳng tên biến môi trường phải đặt. Trả về null
     * khi mọi thứ đã sẵn sàng.
     */
    public static function lyDoChuaSanSang(): ?string
    {
        $mailer = config('mail.default');

        // `array` là mailer của Mail::fake() và của phpunit.xml — thư nằm trong bộ nhớ
        // để bài kiểm thử soi lại. Đó là cách kiểm thử phải làm, không phải cấu hình
        // thiếu sót, nên cho qua; nhờ vậy chính chốt chặn này vẫn kiểm thử được (đặt
        // mail.default = 'log' rồi gọi endpoint).
        if ($mailer === 'array') {
            return null;
        }

        $lyDo = match ($mailer) {
            // Bản triển khai chạy đường này: Render CHẶN mọi kết nối ra cổng SMTP
            // (25/465/587) trên dịch vụ web gói miễn phí, nên Gmail SMTP treo 60 giây
            // rồi hết giờ. Resend đi qua HTTPS cổng 443 nên không dính lệnh chặn đó.
            'resend' => self::thieuGiChoResend(),
            // Máy lập trình vẫn dùng Gmail SMTP — cổng 587 ở nhà không ai chặn.
            'smtp'   => self::thieuGiChoSmtp(),
            default  => "MAIL_MAILER đang là '{$mailer}' chứ không phải 'resend' hay 'smtp' — thư chỉ được ghi vào log, không ai nhận được. Đặt MAIL_MAILER=resend trong biến môi trường của máy chủ.",
        };

        if ($lyDo !== null) {
            return $lyDo;
        }

        // Địa chỉ người gửi là thứ duy nhất cả hai đường đều cần. Với Resend nó còn phải
        // thuộc tên miền ĐÃ XÁC THỰC (funcafe.pro) — để nguyên một địa chỉ @gmail.com là
        // bị Resend từ chối, vì mình không sở hữu gmail.com.
        if (empty(config('mail.from.address'))) {
            return 'Thiếu MAIL_FROM_ADDRESS.';
        }

        return null;
    }

    private static function thieuGiChoResend(): ?string
    {
        if (empty(config('services.resend.key'))) {
            return 'Thiếu RESEND_API_KEY (khóa API tạo ở resend.com, mục API keys).';
        }

        return null;
    }

    private static function thieuGiChoSmtp(): ?string
    {
        $matKhau = config('mail.mailers.smtp.password');

        if (empty($matKhau) || $matKhau === self::MAT_KHAU_MAU) {
            return 'Thiếu MAIL_PASSWORD (mật khẩu ứng dụng 16 ký tự của Gmail, không có dấu cách).';
        }

        if (empty(config('mail.mailers.smtp.username'))) {
            return 'Thiếu MAIL_USERNAME.';
        }

        return null;
    }
}
