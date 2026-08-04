'use client';
import { modeStatus, type ChartMode } from '@/lib/chart';

const MODES: { value: ChartMode; label: string }[] = [
  { value: 'day', label: 'Theo ngày' },
  { value: 'month', label: 'Theo tháng' },
  { value: 'year', label: 'Theo năm' },
];

/**
 * Chọn mốc thời gian cho biểu đồ. Dùng `.segmented` có sẵn trong globals.css
 * (đang dùng ở trang Gói dịch vụ) thay cho <select>: chỉ 3 lựa chọn nên bày hết ra
 * đọc nhanh hơn, và quan trọng hơn là nhìn thấy ngay mốc nào đang không dùng được.
 *
 * Mốc không hợp với khoảng đang lọc thì bị vô hiệu hóa VÀ nói lý do qua `title` —
 * làm mờ mà im lặng thì người dùng chỉ thấy nút hỏng.
 */
export default function ChartModePicker({
  value, onChange, from, to,
}: {
  value: ChartMode;
  onChange: (mode: ChartMode) => void;
  from: string;
  to: string;
}) {
  return (
    <div className="segmented" role="group" aria-label="Mốc thời gian của biểu đồ">
      {MODES.map(m => {
        const { usable, reason } = modeStatus(m.value, from, to);
        const active = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            // Mốc đang được chọn thì không khóa, kể cả khi nó vừa thành không hợp lý:
            // khóa nút đang bật sẽ thành trạng thái không thoát ra được bằng chính nó.
            disabled={!usable && !active}
            onClick={() => onChange(m.value)}
            title={!usable ? reason : undefined}
            aria-pressed={active}
            className={`seg-item ${active ? 'seg-item-active' : ''} ${
              !usable && !active ? 'opacity-40 cursor-not-allowed hover:text-slate' : ''
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
