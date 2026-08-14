import { describe, it, expect } from 'vitest';
import { mapPackage, donDongTinhNang } from './packages';

/**
 * Một trang CÔNG KHAI không được sập chỉ vì một trường dữ liệu sai hình dạng.
 *
 * Chuyện đã xảy ra thật trên bản triển khai: `features` trong CSDL nằm ở dạng chuỗi
 * JSON (ghi lúc model backend còn ép kiểu 'array'), máy chủ trả nguyên chuỗi đó ra,
 * `features.map(...)` ném lỗi và trang Bảng giá TRẮNG TRƠN. Máy phát triển không thấy
 * gì vì CSDL ở đó đã đúng dạng mảng.
 *
 * Máy chủ đã vá, nhưng giao diện phải tự đứng vững — nó không kiểm soát được phiên bản
 * máy chủ đang chạy, và cũng không nên phụ thuộc vào việc ai đó nhớ chạy lệnh dọn.
 */
describe('mapPackage — features luôn ra mảng', () => {
  const goc = { id: '1', name: 'Pro', type: 'pro', status: 'active' };

  it('mảng thật thì giữ nguyên', () => {
    expect(mapPackage({ ...goc, features: ['A', 'B'] }).features).toEqual(['A', 'B']);
  });

  it('CHUỖI JSON vẫn ra mảng — đây là ca đã làm trắng trang Bảng giá', () => {
    expect(mapPackage({ ...goc, features: '["A","B"]' }).features).toEqual(['A', 'B']);
  });

  it('chuỗi JSON có tiếng Việt', () => {
    const chuoi = JSON.stringify(['Không giới hạn bàn', 'Trợ lý AI']);
    expect(mapPackage({ ...goc, features: chuoi }).features).toEqual(['Không giới hạn bàn', 'Trợ lý AI']);
  });

  it('thiếu hẳn trường thì ra mảng rỗng, không phải undefined', () => {
    expect(mapPackage(goc).features).toEqual([]);
    expect(mapPackage({ ...goc, features: null }).features).toEqual([]);
  });

  it('chuỗi thường (không phải JSON) thì coi là một mục, còn hơn mất trắng', () => {
    expect(mapPackage({ ...goc, features: 'Chỉ một dòng' }).features).toEqual(['Chỉ một dòng']);
  });

  it('kết quả LUÔN gọi .map() được — đó mới là điều thật sự cần giữ', () => {
    for (const f of [['A'], '["A"]', 'A', null, undefined, 123, {}]) {
      const kq = mapPackage({ ...goc, features: f }).features;
      expect(Array.isArray(kq)).toBe(true);
      expect(() => kq.map((x) => x.toString())).not.toThrow();
    }
  });
});

/**
 * Quản trị viên sửa các dòng tính năng bằng một ô nhập NHIỀU DÒNG, nên dòng trống
 * và khoảng thừa là chuyện đương nhiên xảy ra: gõ Enter thừa một cái, hay dán từ
 * Word sang. Gửi nguyên như vậy thì trang Bảng giá công khai mọc ra gạch đầu dòng
 * rỗng — trông như lỗi hiển thị, và người thấy nó là khách chứ không phải người
 * vừa bấm Lưu.
 */
describe('donDongTinhNang — dọn dòng trước khi gửi lên máy chủ', () => {
  it('bỏ dòng trống và khoảng thừa hai đầu', () => {
    expect(donDongTinhNang(['  Tối đa 20 bàn  ', '', '   ', 'Thực đơn 40 món']))
      .toEqual(['Tối đa 20 bàn', 'Thực đơn 40 món']);
  });

  it('giữ nguyên THỨ TỰ — đó là thứ tự hiện ra ở trang bảng giá', () => {
    expect(donDongTinhNang(['Ba', 'Một', 'Hai'])).toEqual(['Ba', 'Một', 'Hai']);
  });

  it('không gộp dòng trùng: quản trị viên muốn nhắc lại thì đó là quyền của họ', () => {
    expect(donDongTinhNang(['Hỗ trợ 24/7', 'Hỗ trợ 24/7'])).toEqual(['Hỗ trợ 24/7', 'Hỗ trợ 24/7']);
  });

  it('xóa sạch ô nhập thì ra mảng rỗng, không phải một dòng rỗng', () => {
    expect(donDongTinhNang([''])).toEqual([]);
    expect(donDongTinhNang([])).toEqual([]);
  });

  it('dấu tiếng Việt và ký tự đặc biệt còn nguyên vẹn', () => {
    expect(donDongTinhNang([' Không giới hạn bàn · món ']))
      .toEqual(['Không giới hạn bàn · món']);
  });
});
