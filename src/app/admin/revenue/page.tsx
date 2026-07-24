'use client';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { userService, paymentService } from '@/services';
import { formatCurrency } from '@/lib/format';
import type { User, Payment } from '@/types';
import { DollarSign, TrendingUp, Users, BarChart3, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/user/SectionCard';
import { FilterBar } from '@/components/user/FilterBar';

export default function AdminRevenuePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState('month');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      userService.list(),
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
    const day = (p: Payment) => p.createdAt.slice(0, 10);
    if (fromDate) r = r.filter(p => day(p) >= fromDate);
    if (toDate) r = r.filter(p => day(p) <= toDate);
    return r;
  }, [approvedPayments, fromDate, toDate]);
  const monthlyData = useMemo(() => {
    const sliceLen = viewMode === 'day' ? 10 : viewMode === 'year' ? 4 : 7;
    const groups: Record<string, { revenue: number; users: Set<string> }> = {};
    filteredPayments.forEach(p => {
      const k = p.createdAt.slice(0, sliceLen);
      if (!groups[k]) groups[k] = { revenue: 0, users: new Set() };
      groups[k].revenue += p.amount;
      groups[k].users.add(p.userId);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({
      month: viewMode === 'day' ? k.slice(5) : viewMode === 'year' ? k : `T${k.slice(5)}`,
      revenue: v.revenue,
      users: v.users.size,
    }));
  }, [filteredPayments, viewMode]);

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          <input type="date" className="input-funcafe !w-auto min-w-[150px]" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="Từ ngày" />
          <input type="date" className="input-funcafe !w-auto min-w-[150px]" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="Đến ngày" />
          <select className="input-funcafe !w-auto min-w-[150px]" value={viewMode} onChange={e => setViewMode(e.target.value)}>
            <option value="day">Theo ngày</option>
            <option value="month">Theo tháng</option>
            <option value="year">Theo năm</option>
          </select>
          <button onClick={() => { setFromDate(''); setToDate(''); }} className="btn-secondary">Xóa lọc</button>
        </FilterBar>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title={`Doanh thu ${viewMode === 'day' ? 'theo ngày' : viewMode === 'year' ? 'theo năm' : 'theo tháng'}`} icon={BarChart3} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="month" tick={axis} axisLine={{ stroke: grid }} tickLine={false} />
              <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tipStyle} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
              <Bar dataKey="revenue" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Phân bố gói" icon={Users}>
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

      <SectionCard title="Tăng trưởng người dùng theo tháng" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="month" tick={axis} axisLine={{ stroke: grid }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tipStyle} />
            <Line type="monotone" dataKey="users" stroke="#2563EB" strokeWidth={2.5} dot={{ fill: '#2563EB', r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Đã bỏ bảng "Giao dịch đã duyệt": trùng hoàn toàn với trang Quản lý thanh toán
          (nơi có cả tìm kiếm, lọc theo gói và xem chi tiết), lại còn dùng chữ "đã duyệt"
          trong khi hệ thống không còn khâu duyệt tay nào. Trang này giữ đúng vai trò
          thống kê: chỉ số, biểu đồ và phân bố gói. */}
    </div>
  );
}
