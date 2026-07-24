'use client';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { userService, paymentService } from '@/services';
import { formatCurrency } from '@/lib/format';
import type { User, Payment } from '@/types';
import { Users, CreditCard, TrendingUp, PackageCheck, AlertCircle, BarChart3, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/user/SectionCard';

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const paidPayments = useMemo(() => payments.filter(p => p.status === 'paid'), [payments]);
  const totalRevenue = useMemo(() => paidPayments.reduce((s, p) => s + p.amount, 0), [paidPayments]);
  const approvedPayments = paidPayments;
  const activeUsers = useMemo(() => users.filter(u => u.status === 'active').length, [users]);
  // Trước đây chỗ này đếm "hoàn tiền chờ duyệt" — chỉ số đó luôn bằng 0 vì không nơi
  // nào trong hệ thống tạo ra yêu cầu hoàn tiền chờ xử lý (nâng cấp giữa kỳ cấn trừ
  // thẳng vào hóa đơn mới). Thay bằng số giao dịch đã thanh toán, có ý nghĩa thật.
  const paidCount = paidPayments.length;
  const promaxUsers = useMemo(() => users.filter(u => u.packageType === 'promax').length, [users]);
  const revenueData = useMemo(() => {
    const groups: Record<string, number> = {};
    approvedPayments.forEach(p => {
      const m = p.createdAt.slice(0, 7);
      groups[m] = (groups[m] ?? 0) + p.amount;
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([k, v]) => ({
      month: `T${k.slice(5)}`,
      revenue: v,
    }));
  }, [approvedPayments]);

  if (loading) return <div><PageHeader title="Tổng quan hệ thống" description="Thống kê và hoạt động toàn hệ thống FunCafe" /><LoadingSkeleton variant="card" rows={4} /></div>;
  if (error) return <div><PageHeader title="Tổng quan hệ thống" /><div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải dữ liệu.</span></div></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan hệ thống" description="Thống kê và hoạt động toàn hệ thống FunCafe" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/users" className="block">
          <StatCard label="Tổng người dùng" value={users.length} icon={Users} color="blue" />
        </Link>
        <Link href="/admin/users" className="block">
          <StatCard label="Đang hoạt động" value={activeUsers} icon={PackageCheck} color="green" />
        </Link>
        <Link href="/admin/payments" className="block">
          <StatCard label="Giao dịch đã thanh toán" value={paidCount} icon={CreditCard} color="yellow" />
        </Link>
        <Link href="/admin/revenue" className="block">
          <StatCard label="Doanh thu hệ thống" value={formatCurrency(totalRevenue)} icon={TrendingUp} featured />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Doanh thu theo tháng" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
              <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 12px 30px -16px rgba(15,23,42,.3)' }} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
              <Bar dataKey="revenue" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Phân bố gói dịch vụ" icon={Package}>
          <div className="space-y-3.5">
            {[
              { label: 'Fun Free', count: users.filter(u => u.packageType === 'free').length, total: users.length || 1, color: 'bg-blue-500' },
              { label: 'Pro', count: users.filter(u => u.packageType === 'pro').length, total: users.length || 1, color: 'bg-gold' },
              { label: 'Pro Max', count: promaxUsers, total: users.length || 1, color: 'bg-bean' },
              { label: 'Chưa có gói', count: users.filter(u => u.packageType === 'none').length, total: users.length || 1, color: 'bg-cafe-300' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-sm text-cafe-600 w-24">{item.label}</span>
                <div className="flex-1 bg-sand rounded-full h-2 overflow-hidden">
                  <div className={`${item.color} h-2 rounded-full`} style={{ width: `${(item.count / item.total) * 100}%` }} />
                </div>
                <span className="text-sm font-semibold text-ink w-8 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
