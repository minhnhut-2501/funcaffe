import React from 'react';

interface Props {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Bỏ padding thân (dùng khi nhồi bảng full-bleed). */
  flush?: boolean;
}

/** Vỏ card có tiêu đề — dùng cho các block "Top món", "Biểu đồ", panel... */
export default function SectionCard({ title, subtitle, icon: Icon, action, children, className = '', flush = false }: Props) {
  return (
    <section className={`bg-white rounded-2xl border border-line shadow-soft overflow-hidden ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <span className="w-9 h-9 rounded-xl bg-bean-tint text-bean grid place-items-center shrink-0">
                <Icon className="w-[18px] h-[18px]" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-base font-bold text-ink leading-tight truncate">{title}</h2>}
              {subtitle && <p className="text-xs text-cafe-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-5 sm:p-6'}>{children}</div>
    </section>
  );
}
