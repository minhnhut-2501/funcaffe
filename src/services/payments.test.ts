import { describe, it, expect } from 'vitest';
import { trangThaiCanTru } from './payments';

/**
 * Khoản CẤN TRỪ khi nâng cấp gói giữa kỳ là tiền thật của khách. Nó phải hiện ra.
 *
 * Lỗi đã có thật: máy chủ ngừng ghi cờ `credit_status` (di sản của khâu admin duyệt
 * hoàn tiền, gỡ ngày 22/07/2026) nhưng giao diện vẫn đọc cờ đó ở bốn chỗ. Vì
 * `raw.credit_status ?? 'none'` luôn ra `'none'`, mọi phép kiểm `=== 'applied'` sai
 * vĩnh viễn — khách được cấn trừ tiền mà không nơi nào hiển thị, cả trong lịch sử
 * giao dịch của họ lẫn màn hình đối soát của quản trị. Không có thông báo lỗi nào,
 * chỉ là một dòng lặng lẽ không bao giờ xuất hiện.
 *
 * Nguồn sự thật là chính SỐ TIỀN, không phải một lá cờ mà không ai còn cắm.
 */
describe('trangThaiCanTru', () => {
  it('có credit_amount > 0 thì coi là ĐÃ CẤN TRỪ, dù không có cờ nào', () => {
    expect(trangThaiCanTru({ credit_amount: 150000 })).toBe('applied');
  });

  it('không có cấn trừ thì là none', () => {
    expect(trangThaiCanTru({ credit_amount: 0 })).toBe('none');
    expect(trangThaiCanTru({})).toBe('none');
    expect(trangThaiCanTru(null)).toBe('none');
  });

  it('số gửi dạng chuỗi vẫn hiểu đúng — API đã từng trả số thực lẫn chuỗi', () => {
    expect(trangThaiCanTru({ credit_amount: '150000' })).toBe('applied');
    expect(trangThaiCanTru({ credit_amount: '0' })).toBe('none');
  });

  it('bản ghi lịch sử còn mang cờ cũ thì vẫn tôn trọng cờ đó', () => {
    expect(trangThaiCanTru({ credit_status: 'applied', credit_amount: 0 })).toBe('applied');
    expect(trangThaiCanTru({ credit_status: 'none', credit_amount: 999 })).toBe('none');
  });

  it('cờ rác thì bỏ qua, quay về suy từ số tiền', () => {
    expect(trangThaiCanTru({ credit_status: 'pending', credit_amount: 50000 })).toBe('applied');
    expect(trangThaiCanTru({ credit_status: '', credit_amount: 0 })).toBe('none');
  });
});
