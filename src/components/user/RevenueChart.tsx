'use client';
import { useId } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatCompactCurrency } from '@/lib/format';
import { axisInterval } from '@/lib/chart';

export type RevenuePoint = {
  /** Nhãn ngắn trên trục hoành: '30/04', 'T4', '2026'. */
  label: string;
  /** Nhãn đầy đủ cho tooltip: '30/04/2026'. */
  full: string;
  value: number;
};

/**
 * Ngưỡng đổi dạng biểu đồ. Dưới ngưỡng, việc người dùng cần làm là SO SÁNH từng kỳ
 * với nhau — cột đọc chính xác hơn. Trên ngưỡng, không ai đọc từng cột nữa mà nhìn
 * HÌNH DẠNG (cuối tuần đông hơn, quãng nào ế) — lúc đó vùng tô mới nói được điều đó,
 * còn 62 cột nhét trong một thẻ thì mỗi cột rộng chừng 6px.
 */
const BAR_LIMIT = 14;

const GRID = '#E2E8F0';
const BEAN = '#2563EB';
const tipStyle = {
  borderRadius: 12,
  border: '1px solid #E2E8F0',
  boxShadow: '0 12px 30px -16px rgba(15,23,42,.3)',
} as const;

export default function RevenueChart({
  data,
  height = 260,
  emptyText = 'Không có dữ liệu trong khoảng đã lọc.',
}: {
  data: RevenuePoint[];
  height?: number;
  emptyText?: string;
}) {
  // id của <linearGradient> là TOÀN CỤC theo tài liệu, không theo component. Hai
  // biểu đồ cùng trang mà đặt trùng id thì cái render sau đè nền của cái trước.
  const gradientId = useId().replace(/:/g, '');

  if (data.length === 0) {
    return <p className="text-sm text-cafe-500 text-center py-12">{emptyText}</p>;
  }

  const axisTick = { fontSize: 12, fill: '#64748B' };
  const valueTick = { fontSize: 11, fill: '#94A3B8' };
  // Khoảng không bán được đồng nào: recharts tự lấy miền 0–4 nên trục TIỀN hiện
  // "0 1 2 3 4", vô nghĩa. Chỉ lúc đó mới ép miền — có số liệu thật thì để recharts
  // tự chọn, vì nó làm tròn trần lên mốc đẹp (18tr) thay vì dừng ở đúng đỉnh (16,6tr).
  const yDomain: [number, number] | undefined =
    data.every(d => d.value === 0) ? [0, 1_000_000] : undefined;
  const tooltip = (
    <Tooltip
      formatter={(v: unknown) => [formatCurrency(Number(v)), 'Doanh thu']}
      labelFormatter={(_: unknown, payload: readonly { payload?: RevenuePoint }[]) =>
        payload?.[0]?.payload?.full ?? ''}
      labelStyle={{ color: '#1F2933', fontWeight: 600 }}
      contentStyle={tipStyle}
      cursor={{ fill: 'rgba(37,99,235,0.06)' }}
    />
  );

  if (data.length <= BAR_LIMIT) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" interval={axisInterval(data.length)} tick={axisTick} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis
            domain={yDomain}
            tickFormatter={formatCompactCurrency}
            tick={valueTick}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          {tooltip}
          <Bar dataKey="value" name="Doanh thu" fill={BEAN} radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BEAN} stopOpacity={0.28} />
            <stop offset="100%" stopColor={BEAN} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" interval={axisInterval(data.length)} tick={axisTick} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={formatCompactCurrency} tick={valueTick} axisLine={false} tickLine={false} width={52} />
        {tooltip}
        <Area
          type="monotone"
          dataKey="value"
          name="Doanh thu"
          stroke={BEAN}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          // dot={false}: 62 chấm liền nhau thành một dải đặc, che mất chính đường.
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
