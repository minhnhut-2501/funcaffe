import { describe, it, expect } from 'vitest';
import { fillGaps, axisLabel, fullLabel, bucketCount, suggestMode, modeStatus, keyLength } from './chart';

describe('fillGaps — ngày không bán được gì phải hiện cột 0', () => {
  it('điền đủ mốc trống giữa hai ngày có dữ liệu', () => {
    const out = fillGaps({ '2026-08-01': 100, '2026-08-04': 300 }, 'day', 0);
    expect(out.map((x) => x.key)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']);
    expect(out.map((x) => x.value)).toEqual([100, 0, 0, 300]);
  });

  it('vắt qua ranh giới tháng và năm vẫn liên tục', () => {
    const out = fillGaps({ '2025-12-30': 50, '2026-01-02': 70 }, 'day', 0);
    expect(out.map((x) => x.key)).toEqual([
      '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02',
    ]);
  });

  it('khoảng lọc dài hơn dữ liệu thì hai đầu vẫn là 0, không co lại', () => {
    const out = fillGaps({ '2026-08-03': 10 }, 'day', 0, '2026-08-01', '2026-08-05');
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual({ key: '2026-08-01', value: 0 });
    expect(out[4]).toEqual({ key: '2026-08-05', value: 0 });
  });

  it('chế độ tháng: khoảng lọc dạng YYYY-MM-DD phải cắt về YYYY-MM', () => {
    // Không cắt thì '2026-01-15' > '2026-01' nên mốc tháng đầu tiên bị bỏ mất.
    const out = fillGaps({ '2026-01': 5, '2026-03': 9 }, 'month', 0, '2026-01-15', '2026-03-20');
    expect(out.map((x) => x.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(out.map((x) => x.value)).toEqual([5, 0, 9]);
  });

  it('chế độ năm cộng đúng một năm mỗi bước', () => {
    const out = fillGaps({ '2024': 1, '2026': 3 }, 'year', 0);
    expect(out.map((x) => x.key)).toEqual(['2024', '2025', '2026']);
  });

  it('chọn ngược (từ > đến) thì trả nguyên dữ liệu có sẵn, không lặp vô hạn', () => {
    const out = fillGaps({ '2026-08-02': 7 }, 'day', 0, '2026-08-10', '2026-08-01');
    expect(out).toEqual([{ key: '2026-08-02', value: 7 }]);
  });

  it('khoảng vài chục năm theo ngày bị chặn ở 1000 mốc', () => {
    const out = fillGaps({}, 'day', 0, '2000-01-01', '2050-01-01');
    expect(out).toHaveLength(1000);
  });

  it('không có dữ liệu và không có khoảng lọc thì trả rỗng', () => {
    expect(fillGaps({}, 'day', 0)).toEqual([]);
  });
});

describe('nhãn trục', () => {
  it('chế độ ngày ra DD/MM — không phải MM-DD kiểu ISO', () => {
    // Cắt thẳng chuỗi ISO cho ra "04-30", người Việt đọc thành ngày 4 tháng 30.
    expect(axisLabel('2026-04-30', 'day')).toBe('30/04');
    expect(axisLabel('2026-04', 'month')).toBe('T04');
    expect(axisLabel('2026', 'year')).toBe('2026');
  });

  it('tooltip nói rõ cả năm vì khoảng lọc có thể bắc qua hai năm', () => {
    expect(fullLabel('2026-04-30', 'day')).toBe('30/04/2026');
    expect(fullLabel('2026-04', 'month')).toBe('Tháng 4/2026');
    expect(fullLabel('2026', 'year')).toBe('Năm 2026');
  });

  it('độ dài key khớp từng chế độ', () => {
    expect(keyLength('day')).toBe(10);
    expect(keyLength('month')).toBe(7);
    expect(keyLength('year')).toBe(4);
  });
});

describe('bucketCount', () => {
  it('tính cả hai đầu khoảng', () => {
    expect(bucketCount('day', '2026-08-01', '2026-08-01')).toBe(1);
    expect(bucketCount('day', '2026-08-01', '2026-08-31')).toBe(31);
  });

  it('tháng và năm đếm theo mốc, không theo số ngày', () => {
    expect(bucketCount('month', '2025-11-01', '2026-02-28')).toBe(4);
    expect(bucketCount('year', '2024-01-01', '2026-12-31')).toBe(3);
  });

  it('thiếu đầu vào trả 0 thay vì NaN', () => {
    expect(bucketCount('day', '', '2026-08-01')).toBe(0);
  });
});

describe('suggestMode — mốc mặc định đi theo độ dài khoảng lọc', () => {
  it('khoảng ngắn xem theo ngày', () => {
    expect(suggestMode('2026-08-01', '2026-08-31')).toBe('day');
  });

  it('khoảng một năm xem theo tháng, không vẽ 365 cột', () => {
    expect(suggestMode('2025-09-01', '2026-08-31')).toBe('month');
  });

  it('khoảng nhiều năm xem theo năm', () => {
    expect(suggestMode('2020-01-01', '2026-08-31')).toBe('year');
  });
});

describe('modeStatus — nút bị làm mờ phải nói được lý do', () => {
  it('một mốc duy nhất thì không dùng được và có lý do', () => {
    const s = modeStatus('year', '2026-01-01', '2026-08-31');
    expect(s.usable).toBe(false);
    expect(s.reason).toContain('1 năm');
  });

  it('quá nhiều mốc cũng không dùng được', () => {
    const s = modeStatus('day', '2020-01-01', '2026-01-01');
    expect(s.usable).toBe(false);
    expect(s.reason).toContain('Chọn mốc lớn hơn');
  });

  it('chưa chọn khoảng nào thì không chặn gì cả', () => {
    expect(modeStatus('day', '', '')).toEqual({ buckets: 0, usable: true });
  });

  it('khoảng hợp lý thì dùng được', () => {
    expect(modeStatus('day', '2026-08-01', '2026-08-31')).toEqual({ buckets: 31, usable: true });
  });
});
