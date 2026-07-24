import React from 'react';
import type { TableStatus } from '@/types';

export type Tone = 'success' | 'warning' | 'info' | 'neutral' | 'danger' | 'bean' | 'gold';

const toneCls: Record<Tone, string> = {
  success: 'bg-pine/12 text-pine',
  warning: 'bg-gold/18 text-gold-deep',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-cafe-100 text-cafe-500',
  danger: 'bg-red-100 text-red-700',
  bean: 'bg-bean-tint text-bean',
  gold: 'bg-gold/18 text-gold-deep',
};

const toneDot: Record<Tone, string> = {
  success: 'bg-pine',
  warning: 'bg-gold-deep',
  info: 'bg-blue-600',
  neutral: 'bg-cafe-400',
  danger: 'bg-red-500',
  bean: 'bg-bean',
  gold: 'bg-gold-deep',
};

/** Map trạng thái bàn → tone màu (dùng nhất quán toàn portal). */
export const tableStatusTone: Record<TableStatus, Tone> = {
  empty: 'success',
  serving: 'warning',
};

/** Map trạng thái order → tone màu. */
export const orderStatusTone: Record<string, Tone> = {
  active: 'warning',
  paid: 'success',
  cancelled: 'neutral',
};

interface Props {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function StatusBadge({ tone = 'neutral', dot = true, children, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-semibold ${toneCls[tone]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${toneDot[tone]}`} />}
      {children}
    </span>
  );
}
