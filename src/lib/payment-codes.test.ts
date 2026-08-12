import { describe, it, expect } from 'vitest';
import { lyDoLoi } from './payment-codes';

describe('dịch mã lỗi của cổng thanh toán', () => {
  it('mã hủy của VNPay nói rõ là khách tự hủy', () => {
    expect(lyDoLoi('24', 'vnpay')).toContain('hủy giao dịch');
  });

  it('mã hủy của MoMo dùng bảng của MoMo, không dùng bảng VNPay', () => {
    // 1006 chỉ tồn tại ở MoMo; nếu tra nhầm bảng thì trả null và người dùng lại
    // thấy câu chung chung.
    expect(lyDoLoi('1006', 'momo')).toContain('từ chối xác nhận');
  });

  it('cùng một chuỗi mã có nghĩa KHÁC nhau ở hai cổng', () => {
    // Đây là lý do hàm nhận thêm tham số cổng thay vì gộp một bảng.
    const vnpay = lyDoLoi('51', 'vnpay');
    const momo = lyDoLoi('51', 'momo');
    expect(vnpay).toContain('không đủ số dư');
    expect(momo).toBeNull();  // MoMo không có mã 51 -> thà không nói còn hơn nói sai
  });

  it('mã sai chữ ký được giải thích và trấn an là chưa mất tiền', () => {
    const chu = lyDoLoi('invalid_signature', 'vnpay');
    expect(chu).toContain('không hợp lệ');
    expect(chu).toContain('Không có khoản tiền nào bị trừ');
  });

  it('mã nội bộ dùng chung cho cả hai cổng', () => {
    expect(lyDoLoi('not_found', 'momo')).toBe(lyDoLoi('not_found', 'vnpay'));
  });

  it('mã lạ trả null để nơi gọi dùng câu chung', () => {
    expect(lyDoLoi('9999', 'vnpay')).toBeNull();
    expect(lyDoLoi('abc', 'momo')).toBeNull();
  });

  it('không có mã thì không bịa lý do', () => {
    expect(lyDoLoi(null, 'vnpay')).toBeNull();
    expect(lyDoLoi('', 'vnpay')).toBeNull();
  });

  it('thiếu tên cổng thì mặc định tra bảng VNPay', () => {
    // Cổng cũ chưa đính ?gateway= vẫn phải đọc được mã của nó.
    expect(lyDoLoi('11', null)).toContain('hết thời gian chờ');
  });

  it('mọi câu giải thích đều là tiếng Việt có dấu và kết thúc bằng dấu chấm', () => {
    for (const ma of ['07', '09', '10', '11', '12', '13', '24', '51', '65', '75', '79', '99']) {
      const chu = lyDoLoi(ma, 'vnpay')!;
      expect(chu).toMatch(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i);
      expect(chu.endsWith('.')).toBe(true);
    }
    for (const ma of ['1001', '1003', '1004', '1005', '1006', '1007', '1017', '1026']) {
      expect(lyDoLoi(ma, 'momo')!.endsWith('.')).toBe(true);
    }
  });
});
