<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Số điện thoại Việt Nam — luật DUY NHẤT của cả hệ thống.
 *
 * Trước đây cả hai đầu chỉ kiểm `max:20`, nên "abc", "123" hay một dòng chữ 20 ký tự
 * đều lưu được. Số điện thoại ở đây không phải trang trí: đó là cách duy nhất quản trị
 * viên liên lạc lại với chủ quán khi thanh toán có vấn đề, và là thứ hiện trên hóa đơn
 * của quán. Một số sai nghĩa là mất liên lạc mà không ai biết.
 *
 * Chấp nhận dấu phân cách người ta thật sự gõ (khoảng trắng, dấu chấm, gạch ngang,
 * ngoặc) vì ô nhập trong ứng dụng vẫn gợi ý "0901 234 567" — bỏ hết dấu rồi mới soi.
 *
 * Bản sao ở giao diện: `soDienThoaiHopLe()` trong `src/lib/validate.ts`. Sửa một bên
 * thì phải sửa bên kia — bài `AuthFlowTest::test_so_dien_thoai_giao_dien_chan_thi_may_chu_cung_chan`
 * canh đúng chỗ này.
 */
class SoDienThoaiVN implements ValidationRule
{
    /** Bỏ mọi dấu phân cách để còn lại đúng dãy số (và dấu + của mã quốc gia). */
    public static function chuanHoa(string $value): string
    {
        return preg_replace('/[\s.\-()]/', '', trim($value)) ?? '';
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null || $value === '') {
            return; // Không bắt buộc — để `nullable` quyết định.
        }

        $so = self::chuanHoa((string) $value);

        // Số Việt Nam luôn 10 chữ số khi viết dạng nội địa (0 + 9 số): di động
        // 03/05/07/08/09 và cố định 02x đều vậy. Dạng quốc tế +84/84 thì bỏ số 0.
        if (!preg_match('/^(0\d{9}|\+?84\d{9})$/', $so)) {
            $fail('Số điện thoại không hợp lệ. Ví dụ: 0901234567.');
        }
    }
}
