import { describe, it, expect } from 'vitest';
import { soDienThoaiHopLe, chuanHoaSoDienThoai, MAT_KHAU_TOI_THIEU } from './validate';

/**
 * Luật ở đây là BẢN SAO của `App\Rules\SoDienThoaiVN` bên máy chủ. Bài kiểm này và
 * `AuthFlowTest::test_so_dien_thoai_giao_dien_chan_thi_may_chu_cung_chan` dùng CÙNG
 * một bộ giá trị — sửa một bên mà quên bên kia thì một trong hai đỏ.
 */
describe('soDienThoaiHopLe', () => {
  it('nhận số Việt Nam viết liền', () => {
    expect(soDienThoaiHopLe('0901234567')).toBe(true);
    expect(soDienThoaiHopLe('0287654321')).toBe(true); // cố định Hà Nội/TP.HCM
  });

  it('nhận cả dấu phân cách mà người ta thật sự gõ', () => {
    // Ô nhập ở trang hồ sơ gợi ý đúng dạng này — chặn nó là chặn chính gợi ý của mình.
    expect(soDienThoaiHopLe('0901 234 567')).toBe(true);
    expect(soDienThoaiHopLe('090.123.4567')).toBe(true);
    expect(soDienThoaiHopLe('090-123-4567')).toBe(true);
    expect(soDienThoaiHopLe(' 0901234567 ')).toBe(true);
  });

  it('nhận dạng quốc tế +84', () => {
    expect(soDienThoaiHopLe('+84901234567')).toBe(true);
    expect(soDienThoaiHopLe('84901234567')).toBe(true);
  });

  it('coi ô trống là hợp lệ — số điện thoại không bắt buộc', () => {
    expect(soDienThoaiHopLe('')).toBe(true);
    expect(soDienThoaiHopLe('   ')).toBe(true);
  });

  it('từ chối thứ không phải số điện thoại', () => {
    expect(soDienThoaiHopLe('abc')).toBe(false);
    expect(soDienThoaiHopLe('123')).toBe(false);
    expect(soDienThoaiHopLe('090123456789012')).toBe(false); // quá dài
    expect(soDienThoaiHopLe('1901234567')).toBe(false); // không bắt đầu bằng 0
  });

  it('từ chối số nước ngoài — hệ thống chỉ phục vụ quán trong nước', () => {
    expect(soDienThoaiHopLe('+1 650 253 0000')).toBe(false);
  });

  it('thiếu hoặc thừa đúng một chữ số cũng không qua', () => {
    expect(soDienThoaiHopLe('090123456')).toBe(false);
    expect(soDienThoaiHopLe('09012345678')).toBe(false);
  });
});

describe('chuanHoaSoDienThoai', () => {
  it('bỏ mọi dấu phân cách, giữ nguyên chữ số', () => {
    expect(chuanHoaSoDienThoai('0901 234 567')).toBe('0901234567');
    expect(chuanHoaSoDienThoai('(090) 123-4567')).toBe('0901234567');
  });
});

describe('MAT_KHAU_TOI_THIEU', () => {
  it('khớp với luật min:8 của máy chủ', () => {
    // Đổi số này mà không đổi AuthController là sinh ra form cho bấm Lưu rồi máy chủ
    // trả 422 — loại lỗi người dùng không tự sửa được vì không ô nào sáng đỏ.
    expect(MAT_KHAU_TOI_THIEU).toBe(8);
  });
});
