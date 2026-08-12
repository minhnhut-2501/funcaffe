/**
 * Luật kiểm dữ liệu dùng chung ở giao diện.
 *
 * Mỗi hàm ở đây là BẢN SAO CÓ Ý THỨC của một luật bên máy chủ. Giao diện kiểm để
 * người dùng biết sai ngay khi đang gõ; máy chủ kiểm vì đó mới là chốt thật (ai cũng
 * gọi API trực tiếp được). Hai bên lệch nhau thì sinh ra loại lỗi khó chịu nhất: form
 * cho bấm Lưu rồi máy chủ trả về một câu lỗi mà không ô nào sáng đỏ.
 *
 * Đối chiếu:
 *  - `soDienThoaiHopLe` ↔ `App\Rules\SoDienThoaiVN`
 *  - `MAT_KHAU_TOI_THIEU` ↔ luật `min:8` ở AuthController
 */

/** Độ dài mật khẩu tối thiểu — trùng với `min:8` của máy chủ. */
export const MAT_KHAU_TOI_THIEU = 8;

/** Độ dài tối đa của họ tên — trùng với `max:255` của máy chủ. */
export const HO_TEN_TOI_DA = 255;

/** Bỏ dấu phân cách người ta thật sự gõ: "0901 234 567" → "0901234567". */
export function chuanHoaSoDienThoai(so: string): string {
  return so.trim().replace(/[\s.\-()]/g, '');
}

/**
 * Số điện thoại Việt Nam: 10 chữ số dạng nội địa (0 + 9 số), hoặc +84/84 + 9 số.
 *
 * Ô trống được coi là hợp lệ — số điện thoại không bắt buộc. Nơi gọi tự bắt buộc
 * nếu cần.
 */
export function soDienThoaiHopLe(so: string): boolean {
  const s = chuanHoaSoDienThoai(so);
  if (!s) return true;
  return /^(0\d{9}|\+?84\d{9})$/.test(s);
}

/** Câu nhắc hiện dưới ô nhập khi số sai — dùng cùng một câu ở mọi form. */
export const LOI_SO_DIEN_THOAI = 'Số điện thoại không hợp lệ. Ví dụ: 0901234567.';
