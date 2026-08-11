import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCompactCurrency,
  formatThousands,
  parseThousands,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPaymentMethod,
} from './format';

describe('formatCurrency', () => {
  it('nhóm hàng nghìn bằng dấu chấm', () => {
    expect(formatCurrency(1_250_000)).toBe('1.250.000 ₫');
    expect(formatCurrency(999)).toBe('999 ₫');
  });

  it('hóa đơn 0 đồng vẫn ra "0 ₫", không phải rỗng', () => {
    expect(formatCurrency(0)).toBe('0 ₫');
  });

  it('số âm giữ dấu trừ (hoàn tiền, tiền thối lệch)', () => {
    expect(formatCurrency(-1_500)).toBe('-1.500 ₫');
  });

  it('làm tròn về đồng, không để lại số lẻ', () => {
    expect(formatCurrency(25_499.6)).toBe('25.500 ₫');
  });
});

describe('formatCompactCurrency — nhãn trục biểu đồ', () => {
  it('quán nhỏ bán vài trăm nghìn vẫn đọc được nhãn', () => {
    // Từng dùng cứng (v/1_000_000).toFixed(0)+'tr' nên mọi nhãn đều là "0tr".
    expect(formatCompactCurrency(400_000)).toBe('400k');
    expect(formatCompactCurrency(1_500_000)).toBe('1,5tr');
  });

  it('giữ một chữ số thập phân ở mốc đường lưới lẻ', () => {
    expect(formatCompactCurrency(13_500_000)).toBe('13,5tr');
  });

  it('co giãn đơn vị theo độ lớn', () => {
    expect(formatCompactCurrency(900)).toBe('900');
    expect(formatCompactCurrency(12_000_000)).toBe('12tr');
    expect(formatCompactCurrency(1_200_000_000)).toBe('1,2 tỷ');
  });
});

describe('ô nhập giá', () => {
  it('formatThousands trả rỗng khi bằng 0 để ô nhập không hiện số 0 cứng', () => {
    expect(formatThousands(0)).toBe('');
    expect(formatThousands(25_000)).toBe('25.000');
  });

  it('parseThousands bỏ mọi ký tự không phải chữ số', () => {
    expect(parseThousands('25.000')).toBe(25_000);
    expect(parseThousands('25.000 ₫')).toBe(25_000);
    expect(parseThousands('abc')).toBe(0);
    expect(parseThousands('')).toBe(0);
  });
});

describe('ngày giờ', () => {
  it('chuỗi chỉ có ngày đọc theo UTC nên không bị lùi một ngày ở múi giờ +7', () => {
    expect(formatDate('2026-08-11')).toBe('11/08/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('hóa đơn lúc gần nửa đêm hiển thị đúng ngày theo giờ Việt Nam', () => {
    // 16:50 UTC = 23:50 giờ VN cùng ngày. Đọc nhầm sang UTC là hóa đơn nhảy sang hôm trước.
    const out = formatDateTime('2026-08-11T16:50:00.000000Z');
    expect(out).toBe('23:50 11/08/2026');
  });

  it('quá nửa đêm giờ VN thì sang ngày mới', () => {
    // 17:30 UTC ngày 11 = 00:30 ngày 12 giờ VN.
    expect(formatDateTime('2026-08-11T17:30:00.000000Z')).toBe('00:30 12/08/2026');
  });
});

describe('formatDuration — đơn vị bắt buộc đi kèm', () => {
  it('gói dùng thử tính bằng ngày, không được thành "7 tháng"', () => {
    expect(formatDuration(7, 'day')).toBe('7 ngày');
    expect(formatDuration(12, 'month')).toBe('12 tháng');
  });

  it('thiếu dữ liệu thì trả gạch ngang chứ không đoán bừa', () => {
    expect(formatDuration(undefined)).toBe('—');
  });
});

describe('formatPaymentMethod', () => {
  it('hai giá trị backend thật sự lưu đều có nhãn tiếng Việt', () => {
    expect(formatPaymentMethod('cash')).toBe('Tiền mặt');
    expect(formatPaymentMethod('vietqr')).toBe('Chuyển khoản');
  });

  it('giá trị lạ trả về nguyên văn thay vì rỗng', () => {
    expect(formatPaymentMethod('khong_biet')).toBe('khong_biet');
  });
});
