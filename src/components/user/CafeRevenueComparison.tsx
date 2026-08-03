'use client';
import { formatCurrency } from '@/lib/format';

export type CafeRevenueRowView = {
  id: string;
  name: string;
  revenue: number;
  count: number;
};

/**
 * Bảng xếp hạng doanh thu giữa các quán.
 * Quán chưa phát sinh doanh thu vẫn được giữ trong danh sách với số 0 — biến mất
 * khỏi bảng sẽ khiến chủ quán tưởng thiếu quán chứ không phải quán đó ế.
 */
export default function CafeRevenueComparison({
  rows,
  emptyText = 'Chưa quán nào có doanh thu trong khoảng này.',
}: {
  rows: CafeRevenueRowView[];
  emptyText?: string;
}) {
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  const max = sorted[0]?.revenue ?? 0;
  const total = sorted.reduce((s, r) => s + r.revenue, 0);

  if (max === 0) {
    return <p className="text-sm text-cafe-500 text-center py-6">{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      {sorted.map((c, idx) => (
        <div key={c.id}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-sm font-medium text-ink flex items-center gap-2 min-w-0">
              <span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${idx === 0 ? 'bg-gold text-white' : 'bg-sand text-cafe-600'}`}>
                {idx + 1}
              </span>
              <span className="truncate">{c.name}</span>
            </span>
            <span className="text-sm font-bold text-ink tabular-nums shrink-0">{formatCurrency(c.revenue)}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-sand rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${idx === 0 ? 'bg-bean' : 'bg-bean/45'}`}
                style={{ width: `${(c.revenue / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-cafe-500 w-28 text-right shrink-0 tabular-nums">
              {c.count} hóa đơn · {total > 0 ? Math.round((c.revenue / total) * 100) : 0}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
