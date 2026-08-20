import { describe, it, expect } from 'vitest';
import { goTien } from './nhap-tien';

/**
 * Mỗi bài dưới đây là MỘT lần gõ: `tho` là nội dung ô ngay sau khi trình duyệt chèn
 * hoặc xóa ký tự, `caret` là chỗ con trỏ đang đứng lúc đó.
 */
describe('goTien', () => {
  it('gõ thêm số ở CUỐI: con trỏ ở lại cuối', () => {
    // "20.000" gõ thêm số 0 ở cuối
    expect(goTien('20.0000', 7)).toEqual({ so: 200000, hien: '200.000', caret: 7 });
  });

  it('gõ thêm số ở GIỮA: con trỏ bám ngay sau chữ số vừa gõ, không nhảy về cuối', () => {
    // "20.000" đặt con trỏ sau số 2 rồi gõ 0 → "200.000", con trỏ sau chữ số thứ 2.
    // Đây chính là lỗi cũ: con trỏ nhảy đi chỗ khác nên số 0 kế tiếp chèn nhầm chỗ,
    // "20.000" biến thành "2.000.000".
    expect(goTien('200.000', 2)).toEqual({ so: 200000, hien: '200.000', caret: 2 });
    // gõ tiếp một số 0 nữa ngay tại đó
    expect(goTien('2000.000', 3)).toEqual({ so: 2000000, hien: '2.000.000', caret: 4 });
  });

  it('vượt mốc nghìn (mọc thêm dấu chấm) không đẩy con trỏ đi', () => {
    expect(goTien('1000', 4)).toEqual({ so: 1000, hien: '1.000', caret: 5 });
  });

  it('xóa bớt một chữ số: con trỏ ở lại đúng chỗ vừa xóa', () => {
    // "2.000.000" xóa chữ số thứ 4 → còn 3 chữ số trước con trỏ, con trỏ đứng ngay
    // sau chữ số thứ 3 của chuỗi mới ("200|.000"), không bị dấu chấm kéo đi.
    expect(goTien('2.00.000', 4)).toEqual({ so: 200000, hien: '200.000', caret: 3 });
  });

  it('số 0 thừa ở đầu bị bỏ thì con trỏ lùi theo, không dôi ra một chỗ', () => {
    expect(goTien('020.000', 1)).toEqual({ so: 20000, hien: '20.000', caret: 0 });
  });

  it('ô rỗng cho null — CHƯA NHẬP GÌ khác hẳn số 0', () => {
    expect(goTien('', 0)).toEqual({ so: null, hien: '', caret: 0 });
  });

  it('bỏ mọi ký tự không phải chữ số (dán chữ, dán tiền có ký hiệu)', () => {
    expect(goTien('199.000 ₫', 9)).toEqual({ so: 199000, hien: '199.000', caret: 7 });
    expect(goTien('abc', 3)).toEqual({ so: null, hien: '', caret: 0 });
  });
});
