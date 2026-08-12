'use client';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { userService, paymentService } from '@/services';
import { formatCurrency, ngayDiaPhuong } from '@/lib/format';
import type { User, Payment } from '@/types';
import { DollarSign, TrendingUp, Users, BarChart3, AlertCircle } from 'lucide-react';
import { ComposedChart, Bar, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/user/SectionCard';
import { FilterBar } from '@/components/user/FilterBar';
import DateRangePicker from '@/components/ui/DateRangePicker';
import RevenueChart, { type RevenuePoint } from '@/components/user/RevenueChart';
import ChartModePicker from '@/components/user/ChartModePicker';
import { fillGaps, keyLength, axisLabel, fullLabel, axisInterval, suggestMode, type ChartMode } from '@/lib/chart';

export default function AdminRevenuePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // null = chưa tự chọn mốc -> bám theo độ dài khoảng đang lọc (xem ChartModePicker).
  const [viewMode, setViewMode] = useState<ChartMode | null>(null);
  const effectiveMode = viewMode ?? suggestMode(fromDate, toDate);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      // listAll chứ không list: biểu đồ tăng trưởng bên dưới đếm trên TOÀN BỘ tài
      // khoản. `list` chỉ trả trang đầu (50 bản ghi) nên đường lũy kế sẽ đứng yên
      // ngay khi hệ thống vượt 50 người dùng, mà không có dấu hiệu gì là sai.
      userService.listAll(),
      paymentService.list(),
    ]).then(([u, p]) => {
      if (cancelled) return;
      setUsers(u);
      setPayments(p);
    }).catch(() => {
      if (!cancelled) setError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const thisMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // BUG-19 FIX: Chỉ tính giao dịch đã thanh toán
  const approvedPayments = useMemo(() => payments.filter(p => p.status === 'paid'), [payments]);
  const totalRevenue = useMemo(() => approvedPayments.reduce((s, p) => s + p.amount, 0), [approvedPayments]);
  const avgRevenue = useMemo(() => approvedPayments.length > 0 ? Math.round(totalRevenue / approvedPayments.length) : 0, [approvedPayments, totalRevenue]);
  const thisMonthRevenue = useMemo(() => approvedPayments.filter(p => p.createdAt.startsWith(thisMonthKey)).reduce((s, p) => s + p.amount, 0), [approvedPayments, thisMonthKey]);
  // Bộ lọc chỉ áp cho 2 biểu đồ theo thời gian bên dưới (StatCard/Pie/bảng giữ tổng quan).
  const filteredPayments = useMemo(() => {
    let r = approvedPayments;
    const day = (p: Payment) => ngayDiaPhuong(p.createdAt);
    if (fromDate) r = r.filter(p => day(p) >= fromDate);
    if (toDate) r = r.filter(p => day(p) <= toDate);
    return r;
  }, [approvedPayments, fromDate, toDate]);
  // Doanh thu theo mốc. KHÔNG còn .slice(-12): người dùng lọc 30 ngày rồi chọn xem
  // theo ngày mà biểu đồ chỉ vẽ 12 ngày cuối, 18 ngày đầu biến mất không báo gì —
  // bộ lọc nói một đằng, biểu đồ hiện một nẻo. Khoảng lọc là thứ quyết định vẽ bao
  // nhiêu, còn số mốc quá dày thì ChartModePicker đã chặn từ đầu vào.
  const revenueSeries = useMemo<RevenuePoint[]>(() => {
    const groups: Record<string, number> = {};
    filteredPayments.forEach(p => {
      const k = p.createdAt.slice(0, keyLength(effectiveMode));
      groups[k] = (groups[k] ?? 0) + p.amount;
    });
    return fillGaps(groups, effectiveMode, 0, fromDate, toDate).map(({ key, value }) => ({
      label: axisLabel(key, effectiveMode),
      full: fullLabel(key, effectiveMode),
      value,
    }));
  }, [filteredPayments, effectiveMode, fromDate, toDate]);

  // Tăng trưởng người dùng — tính từ NGÀY ĐĂNG KÝ, không phải từ giao dịch.
  // Trước đây chỗ này đếm số user distinct có giao dịch trong kỳ, mà đó là "khách có
  // phát sinh giao dịch": một tháng không ai đăng ký mới nhưng 50 người gia hạn thì
  // đường vẫn vọt lên, đọc thành "tăng trưởng" là sai hẳn bản chất.
  // `users` đã tải sẵn ở trên nên không cần gọi thêm API nào.
  const growthSeries = useMemo(() => {
    const groups: Record<string, number> = {};
    users.forEach(u => {
      if (!u.createdAt) return;
      const k = u.createdAt.slice(0, keyLength(effectiveMode));
      groups[k] = (groups[k] ?? 0) + 1;
    });
    const rows = fillGaps(groups, effectiveMode, 0, fromDate, toDate);
    // Lũy kế phải tính từ TOÀN BỘ tài khoản, không chỉ trong khoảng lọc: xem 3 tháng
    // gần đây mà đường lũy kế bắt đầu từ 0 thì thành "hệ thống mới có người dùng".
    const firstKey = rows[0]?.key ?? '';
    let running = firstKey
      ? users.filter(u => u.createdAt && u.createdAt.slice(0, keyLength(effectiveMode)) < firstKey).length
      : 0;
    return rows.map(({ key, value }) => {
      running += value;
      return {
        label: axisLabel(key, effectiveMode),
        full: fullLabel(key, effectiveMode),
        newUsers: value,
        cumulative: running,
      };
    });
  }, [users, effectiveMode, fromDate, toDate]);

  if (loading) return <div><PageHeader title="Doanh thu hệ thống" description="Thống kê doanh thu từ các gói dịch vụ" /><LoadingSkeleton variant="card" rows={4} /></div>;
  if (error) return <div><PageHeader title="Doanh thu hệ thống" /><div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải dữ liệu.</span></div></div>;

  const pkgData = [
    { name: 'Fun Free', value: users.filter(u => u.packageType === 'free').length, color: '#3B82F6' },
    { name: 'Pro', value: users.filter(u => u.packageType === 'pro').length, color: '#D6A85A' },
    { name: 'Pro Max', value: users.filter(u => u.packageType === 'promax').length, color: '#2563EB' },
  ];
  const axis = { fontSize: 12, fill: '#64748B' };
  const grid = '#E2E8F0';
  const tipStyle = { borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 12px 30px -16px rgba(15,23,42,.3)' } as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Doanh thu hệ thống" description="Thống kê doanh thu từ các gói dịch vụ" />

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tổng doanh thu" value={formatCurrency(totalRevenue)} icon={DollarSign} featured />
        <StatCard label="Doanh thu tháng này" value={formatCurrency(thisMonthRevenue)} icon={TrendingUp} color="green" />
        <StatCard label="Giao dịch thành công" value={approvedPayments.length} icon={BarChart3} color="blue" />
        <StatCard label="Trung bình/giao dịch" value={formatCurrency(avgRevenue)} icon={Users} color="yellow" />
      </div>

      {/* Bộ lọc chỉ áp cho biểu đồ doanh thu & tăng trưởng người dùng bên dưới */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-cafe-600">
          <BarChart3 className="w-4 h-4 text-bean" />
          <span>Lọc biểu đồ</span>
        </div>
        <FilterBar>
          <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t); }} />
          <ChartModePicker value={effectiveMode} onChange={setViewMode} from={fromDate} to={toDate} />
          <button onClick={() => { setFromDate(''); setToDate(''); setViewMode(null); }} className="btn-secondary">Xóa lọc</button>
        </FilterBar>
      </div>

      <SectionCard
        title={`Doanh thu ${effectiveMode === 'day' ? 'theo ngày' : effectiveMode === 'year' ? 'theo năm' : 'theo tháng'}`}
        subtitle={`${revenueSeries.length} mốc · chỉ tính giao dịch đã thanh toán`}
        icon={BarChart3}
      >
        <RevenueChart data={revenueSeries} />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard
          title={`Tăng trưởng người dùng ${effectiveMode === 'day' ? 'theo ngày' : effectiveMode === 'year' ? 'theo năm' : 'theo tháng'}`}
          subtitle="Cột: tài khoản mới trong kỳ · Đường: tổng tài khoản tích lũy"
          icon={TrendingUp}
          className="lg:col-span-2"
        >
          {growthSeries.length === 0 ? (
            <p className="text-sm text-cafe-500 text-center py-12">Không có dữ liệu trong khoảng đã lọc.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={growthSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="label" interval={axisInterval(growthSeries.length)} tick={axis} axisLine={{ stroke: grid }} tickLine={false} minTickGap={24} />
                {/* Hai trục: số tài khoản mới mỗi kỳ (vài cái) và tổng tích lũy (hàng
                    trăm) chênh nhau cả bậc — ép chung một trục thì cột mới bẹp dí. */}
                <YAxis yAxisId="new" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <YAxis yAxisId="total" orientation="right" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip
                  contentStyle={tipStyle}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ''}
                  labelStyle={{ color: '#1F2933', fontWeight: 600 }}
                  cursor={{ fill: 'rgba(37,99,235,0.06)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar yAxisId="new" dataKey="newUsers" name="Tài khoản mới" fill="#93B4F5" radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Line yAxisId="total" type="monotone" dataKey="cumulative" name="Tổng tích lũy" stroke="#2563EB" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard
          title="Phân bố gói"
          subtitle="Hiện tại · không theo bộ lọc thời gian"
          icon={Users}
        >
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pkgData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {pkgData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, name) => [v, name]} contentStyle={tipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pkgData.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-cafe-600 flex-1">{d.name}</span>
                <span className="font-semibold text-ink">{d.value} user</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Đã bỏ bảng "Giao dịch đã duyệt": trùng hoàn toàn với trang Giao dịch thanh toán
          (nơi có cả tìm kiếm, lọc theo gói và xem chi tiết), lại còn dùng chữ "đã duyệt"
          trong khi hệ thống không còn khâu duyệt tay nào. Trang này giữ đúng vai trò
          thống kê: chỉ số, biểu đồ và phân bố gói. */}
    </div>
  );
}
