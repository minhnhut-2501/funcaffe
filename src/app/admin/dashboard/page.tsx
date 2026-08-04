'use client';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { userService, paymentService } from '@/services';
import { formatCurrency } from '@/lib/format';
import type { User, Payment } from '@/types';
import {
  Users, CreditCard, TrendingUp, PackageCheck, AlertCircle, BarChart3, Package,
  UserPlus, History, ArrowRight,
} from 'lucide-react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/user/SectionCard';
import ActivityFeed, { type ActivityItem, type ActivityTone } from '@/components/user/ActivityFeed';
import { fillGaps, axisLabel, fullLabel } from '@/lib/chart';
import RevenueChart from '@/components/user/RevenueChart';

const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const statusTone: Record<string, ActivityTone> = {
  paid: 'pine',
  pending: 'gold',
  failed: 'neutral',
  rejected: 'neutral',
};
const statusLabel: Record<string, string> = {
  paid: 'đã thanh toán',
  pending: 'chờ duyệt',
  failed: 'thất bại',
  rejected: 'bị từ chối',
};

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
  const activeUsers = useMemo(() => users.filter(u => u.status === 'active').length, [users]);
  // Trước đây chỗ này đếm "hoàn tiền chờ duyệt" — chỉ số đó luôn bằng 0 vì không nơi
  // nào trong hệ thống tạo ra yêu cầu hoàn tiền chờ xử lý (nâng cấp giữa kỳ cấn trừ
  // thẳng vào hóa đơn mới). Thay bằng số giao dịch đã thanh toán, có ý nghĩa thật.
  const paidCount = paidPayments.length;
  const promaxUsers = useMemo(() => users.filter(u => u.packageType === 'promax').length, [users]);

  // So sánh tháng này với tháng trước — cùng nguồn dữ liệu, không gọi thêm API.
  const { thisMonthRevenue, monthDelta, newUsersThisMonth, pendingCount } = useMemo(() => {
    const now = new Date();
    const cur = monthKey(now);
    const prev = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const sumIn = (k: string) => paidPayments.filter(p => p.createdAt.startsWith(k)).reduce((s, p) => s + p.amount, 0);
    const curRev = sumIn(cur);
    const prevRev = sumIn(prev);
    return {
      thisMonthRevenue: curRev,
      monthDelta: prevRev > 0 ? Math.round(((curRev - prevRev) / prevRev) * 100) : null,
      newUsersThisMonth: users.filter(u => u.createdAt?.startsWith(cur)).length,
      pendingCount: payments.filter(p => p.status === 'pending').length,
    };
  }, [paidPayments, payments, users]);

  const revenueData = useMemo(() => {
    const groups: Record<string, number> = {};
    paidPayments.forEach(p => {
      const m = p.createdAt.slice(0, 7);
      groups[m] = (groups[m] ?? 0) + p.amount;
    });
    // Điền tháng trống trước rồi mới lấy 6 tháng CUỐI: nếu không, tháng không có
    // giao dịch nào bị bỏ hẳn khỏi trục và biểu đồ trông như tháng nào cũng có tiền về.
    return fillGaps(groups, 'month', 0).slice(-6).map(({ key, value }) => ({
      label: axisLabel(key, 'month'),
      full: fullLabel(key, 'month'),
      value,
    }));
  }, [paidPayments]);

  const recentPayments: ActivityItem[] = useMemo(() =>
    [...payments]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 6)
      .map((p): ActivityItem => ({
        id: `pay-${p.id}`,
        icon: CreditCard,
        tone: statusTone[p.status] ?? 'neutral',
        title: <><span className="font-medium">{p.userName}</span> · {p.packageName} {statusLabel[p.status] ?? p.status}</>,
        at: p.createdAt,
        trailing: formatCurrency(p.amount),
      })),
  [payments]);

  const recentUsers: ActivityItem[] = useMemo(() =>
    [...users]
      .filter(u => u.createdAt)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 6)
      .map((u): ActivityItem => ({
        id: `user-${u.id}`,
        icon: UserPlus,
        tone: 'bean',
        title: <><span className="font-medium">{u.fullName}</span>{u.cafeName ? ` · ${u.cafeName}` : ''}</>,
        at: u.createdAt,
        trailing: u.packageName,
      })),
  [users]);

  if (loading) return <div><PageHeader title="Tổng quan hệ thống" description="Thống kê và hoạt động toàn hệ thống FunCafe" /><LoadingSkeleton variant="card" rows={4} /></div>;
  if (error) return <div><PageHeader title="Tổng quan hệ thống" /><div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải dữ liệu.</span></div></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan hệ thống" description="Thống kê và hoạt động toàn hệ thống FunCafe" />

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/users" className="block">
          <StatCard
            label="Tổng người dùng"
            value={users.length}
            icon={Users}
            color="blue"
            hint={newUsersThisMonth > 0 ? `+${newUsersThisMonth} trong tháng này` : 'Chưa có ai mới tháng này'}
          />
        </Link>
        <Link href="/admin/users" className="block">
          <StatCard
            label="Đang hoạt động"
            value={activeUsers}
            icon={PackageCheck}
            color="green"
            hint={`${promaxUsers} tài khoản Pro Max`}
          />
        </Link>
        <Link href="/admin/payments" className="block">
          <StatCard
            label="Giao dịch thành công"
            value={paidCount}
            icon={CreditCard}
            color="yellow"
            hint={pendingCount > 0 ? `${pendingCount} đang chờ duyệt` : 'Không có đơn chờ duyệt'}
          />
        </Link>
        <Link href="/admin/revenue" className="block">
          <StatCard
            label="Doanh thu hệ thống"
            value={formatCurrency(totalRevenue)}
            icon={TrendingUp}
            featured
            hint={
              // Đầu tháng chưa có giao dịch nào thì đừng báo "giảm 100%" — con số
              // đúng về mặt số học nhưng làm người đọc tưởng hệ thống đang tụt dốc.
              thisMonthRevenue === 0
                ? 'Tháng này chưa có giao dịch'
                : monthDelta !== null
                  ? `Tháng này ${formatCurrency(thisMonthRevenue)} · ${monthDelta >= 0 ? 'tăng' : 'giảm'} ${Math.abs(monthDelta)}%`
                  : `Tháng này ${formatCurrency(thisMonthRevenue)}`
            }
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Doanh thu 6 tháng gần nhất" icon={BarChart3} className="lg:col-span-2">
          <RevenueChart data={revenueData} height={230} emptyText="Chưa có giao dịch nào." />
        </SectionCard>

        <SectionCard title="Phân bố gói dịch vụ" icon={Package}>
          <div className="space-y-3.5">
            {[
              { label: 'Fun Free', count: users.filter(u => u.packageType === 'free').length, color: 'bg-blue-500' },
              { label: 'Pro', count: users.filter(u => u.packageType === 'pro').length, color: 'bg-gold' },
              { label: 'Pro Max', count: promaxUsers, color: 'bg-bean' },
              { label: 'Chưa có gói', count: users.filter(u => u.packageType === 'none').length, color: 'bg-cafe-300' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-sm text-cafe-600 w-24 shrink-0">{item.label}</span>
                <div className="flex-1 bg-sand rounded-full h-2 overflow-hidden">
                  <div className={`${item.color} h-2 rounded-full transition-all duration-500`} style={{ width: `${(item.count / (users.length || 1)) * 100}%` }} />
                </div>
                <span className="text-sm font-semibold text-ink w-8 text-right tabular-nums">{item.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Giao dịch gần đây"
          icon={History}
          action={
            <Link href="/admin/payments" className="text-sm font-semibold text-bean hover:underline inline-flex items-center gap-1">
              Tất cả <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <ActivityFeed items={recentPayments} emptyText="Chưa có giao dịch nào." />
        </SectionCard>

        <SectionCard
          title="Người dùng mới"
          icon={UserPlus}
          action={
            <Link href="/admin/users" className="text-sm font-semibold text-bean hover:underline inline-flex items-center gap-1">
              Tất cả <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <ActivityFeed items={recentUsers} emptyText="Chưa có người dùng nào." />
        </SectionCard>
      </div>
    </div>
  );
}
