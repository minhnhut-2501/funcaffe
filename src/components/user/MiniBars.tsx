'use client';

export type MiniBar = { label: string; value: number; highlight?: boolean };

/**
 * Biểu đồ cột nhỏ vẽ bằng div thuần.
 * Cố tình không dùng recharts: trang tổng quan là trang người dùng mở nhiều nhất
 * trong ngày, kéo cả thư viện biểu đồ về chỉ để vẽ 7 cột sẽ làm trang nặng thêm
 * hơn 100KB mà không được lợi gì.
 */
export default function MiniBars({
  data,
  format,
  className = '',
  height = 'h-40',
}: {
  data: MiniBar[];
  /** Định dạng giá trị khi rê chuột và cho phần mô tả trợ năng. */
  format: (v: number) => string;
  className?: string;
  height?: string;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  const summary = data.map(d => `${d.label}: ${format(d.value)}`).join(', ');

  return (
    <div className={className} role="img" aria-label={summary}>
      <div className={`flex items-end gap-1.5 sm:gap-2 ${height}`}>
        {data.map((d, i) => {
          // Cột có số liệu luôn cao tối thiểu 4% để không biến mất hoàn toàn.
          const pct = d.value > 0 ? Math.max((d.value / max) * 100, 4) : 0;
          return (
            <div key={`${d.label}-${i}`} className="flex-1 h-full flex items-end" title={`${d.label}: ${format(d.value)}`}>
              {d.value > 0 ? (
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${
                    d.highlight ? 'bg-bean' : 'bg-bean/30 hover:bg-bean/50'
                  }`}
                  style={{ height: `${pct}%` }}
                />
              ) : (
                <div className="w-full h-0.5 rounded-full bg-line" />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 sm:gap-2 mt-2">
        {data.map((d, i) => (
          <span
            key={`${d.label}-label-${i}`}
            className={`flex-1 text-center text-[11px] ${d.highlight ? 'font-semibold text-ink' : 'text-cafe-500'}`}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
