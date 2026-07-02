import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  hint?: string;
  color?: 'brown' | 'blue' | 'green' | 'yellow' | 'red';
  /** Biến thể nổi bật (nền bean) — dùng cho ô doanh thu chính. */
  featured?: boolean;
}

const colorMap = {
  brown: 'bg-bean-tint text-bean',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-pine/12 text-pine',
  yellow: 'bg-gold/18 text-gold-deep',
  red: 'bg-red-100 text-red-700',
};

export default function StatCard({ label, value, icon: Icon, trend, trendUp, hint, color = 'brown', featured = false }: Props) {
  if (featured) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-bean text-white p-5 shadow-card">
        <div aria-hidden className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/75 truncate">{label}</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1 truncate">{value}</p>
            {hint && <p className="text-xs text-white/70 mt-1">{hint}</p>}
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/15 grid place-items-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-2xl bg-white border border-line p-5 shadow-soft transition-all duration-200 hover:shadow-card hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-cafe-500 font-medium truncate">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-ink mt-1 truncate">{value}</p>
          {hint && <p className="text-xs text-cafe-400 mt-1 truncate">{hint}</p>}
          {trend && (
            <p className={cn('text-xs mt-1 font-semibold', trendUp ? 'text-pine' : 'text-red-500')}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        <div className={cn('w-11 h-11 rounded-xl grid place-items-center shrink-0 transition-transform duration-200 group-hover:scale-105', colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
