'use client';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type ActivityTone = 'bean' | 'pine' | 'gold' | 'neutral';

export type ActivityItem = {
  id: string;
  icon: LucideIcon;
  tone: ActivityTone;
  title: ReactNode;
  /** Mốc thời gian ISO của sự việc. */
  at: string;
  /** Cột phải, thường là số tiền. */
  trailing?: string;
};

const toneCls: Record<ActivityTone, string> = {
  bean: 'bg-bean-tint text-bean',
  pine: 'bg-pine/12 text-pine',
  gold: 'bg-gold/15 text-gold-deep',
  neutral: 'bg-sand text-cafe-600',
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Vừa xảy ra thì đọc "x phút trước" cho dễ hình dung, xa hơn thì hiện giờ/ngày
 * cụ thể. Chỉ chạy ở phía trình duyệt sau khi dữ liệu tải xong nên không gây
 * lệch nội dung khi hydrate.
 */
function timeLabel(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;

  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameDay ? hm : `${hm} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export default function ActivityFeed({
  items,
  emptyText = 'Chưa có hoạt động nào.',
}: {
  items: ActivityItem[];
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-cafe-500 text-center py-8">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-line/70">
      {items.map(item => (
        <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${toneCls[item.tone]}`}>
            <item.icon className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink truncate">{item.title}</p>
            <p className="text-xs text-cafe-500">{timeLabel(item.at)}</p>
          </div>
          {item.trailing && (
            <span className="text-sm font-semibold text-ink tabular-nums shrink-0">{item.trailing}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
