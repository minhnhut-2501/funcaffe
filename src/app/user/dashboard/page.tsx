'use client';
import Link from 'next/link';
import { ShoppingCart, UtensilsCrossed, Receipt, TrendingUp, Users, ClipboardList, CreditCard, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import LockedBox from '@/components/ui/LockedBox';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/user/SectionCard';
import { useAuth } from '@/context/AuthContext';
import { invoiceService, orderService, tableService } from '@/services';
import { useApi } from '@/hooks/use-api';
import { canViewRevenue } from '@/lib/permission';
import { formatCurrency } from '@/lib/format';

const quickActions = [
  { href: '/user/sales', icon: ShoppingCart, label: 'Tạo order mới', desc: 'Mở màn bán hàng' },
  { href: '/user/menu', icon: UtensilsCrossed, label: 'Quản lý thực đơn', desc: 'Món, size, topping' },
  { href: '/user/invoices', icon: Receipt, label: 'Xem hóa đơn', desc: 'Lịch sử thanh toán' },
  { href: '/user/subscription', icon: CreditCard, label: 'Gói dịch vụ', desc: 'Nâng cấp / gia hạn' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const sub = user?.subscription;
  const { data: invoices, loading: loadingInv, error: errorInv } = useApi(() => invoiceService.list());
  const { data: orders, loading: loadingOrd, error: errorOrd } = useApi(() => orderService.list());
  const { data: tables, loading: loadingTbl, error: errorTbl } = useApi(() => tableService.list());

  const activeOrders = orders?.filter(o => o.status === 'active').length ?? 0;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayRevenue = invoices?.filter(i => i.createdAt?.startsWith(todayStr)).reduce((s, i) => s + i.totalAmount, 0) ?? 0;
  const todayInvoicesCount = invoices?.filter(i => i.createdAt?.startsWith(todayStr)).length ?? 0;
  const availableTables = tables?.filter(t => t.status === 'empty').length ?? 0;

  if (loadingInv || loadingOrd || loadingTbl) {
    return (
      <div>
        <PageHeader title="Tổng quan" description="Chào mừng bạn trở lại!" />
        <LoadingSkeleton variant="card" rows={4} />
      </div>
    );
  }

  if (errorInv || errorOrd || errorTbl) {
    return (
      <div>
        <PageHeader title="Tổng quan" description="Chào mừng bạn trở lại!" />
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5" />
          <span>Không thể tải dữ liệu. Vui lòng thử lại sau.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan"
        description="Một cái nhìn nhanh về tình hình quán hôm nay."
        actions={<Link href="/user/sales" className="btn-primary"><ShoppingCart className="w-4 h-4" />Bán hàng</Link>}
      />

      {/* Gói hiện tại */}
      <div className={`rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap ${
        sub?.packageType === 'promax' ? 'bg-bean text-white shadow-card' :
        sub?.packageType === 'pro' ? 'bg-bean-tint border border-line' :
        sub?.packageType === 'free' ? 'bg-blue-50 border border-blue-100' :
        'bg-gold/10 border border-gold/25'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${sub?.packageType === 'promax' ? 'bg-white/15' : 'bg-white'}`}>
            <Sparkles className={`w-5 h-5 ${sub?.packageType === 'promax' ? 'text-gold' : 'text-bean'}`} />
          </span>
          <div className="min-w-0">
            <p className={`text-xs font-medium ${sub?.packageType === 'promax' ? 'text-white/75' : 'text-cafe-500'}`}>Gói hiện tại</p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-lg font-bold ${sub?.packageType === 'promax' ? 'text-white' : 'text-ink'}`}>
                {sub?.packageName}
                {sub?.packageType !== 'none' && <span className={`text-sm font-normal ml-2 ${sub?.packageType === 'promax' ? 'text-white/70' : 'text-cafe-500'}`}>· Còn {sub?.daysLeft} ngày</span>}
              </p>
              {sub?.isPendingReview && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gold/20 text-gold-deep font-semibold">Chờ duyệt</span>
              )}
            </div>
          </div>
        </div>
        <Link href="/user/subscription" className={`text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0 ${sub?.packageType === 'promax' ? 'bg-white/15 text-white hover:bg-white/25' : 'btn-primary'}`}>
          {sub?.packageType === 'none' ? 'Chọn gói ngay' : 'Quản lý gói'}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Order đang hoạt động" value={activeOrders} icon={ClipboardList} color="green" />
        <StatCard label="Bàn trống" value={availableTables} icon={Users} color="blue" />
        <StatCard label="Hóa đơn hôm nay" value={todayInvoicesCount} icon={Receipt} color="brown" />
        {canViewRevenue(user?.subscription)
          ? <StatCard label="Doanh thu hôm nay" value={formatCurrency(todayRevenue)} icon={TrendingUp} hint={`${todayInvoicesCount} hóa đơn`} featured />
          : <StatCard label="Doanh thu tạm tính" value="—" icon={TrendingUp} color="yellow" />}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-cafe-500 uppercase tracking-wider mb-3">Lối tắt</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((a) => (
            <Link key={a.href} href={a.href} className="group rounded-2xl bg-white border border-line p-4 shadow-soft transition-all duration-200 hover:shadow-card hover:-translate-y-0.5 hover:border-cafe-300">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-bean-tint text-bean grid place-items-center transition-transform group-hover:scale-105">
                  <a.icon className="w-5 h-5" />
                </span>
                <ArrowRight className="w-4 h-4 text-cafe-300 group-hover:text-bean group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-sm font-semibold text-ink mt-3">{a.label}</p>
              <p className="text-xs text-cafe-400 mt-0.5">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Doanh thu */}
      {!canViewRevenue(user?.subscription) ? (
        <LockedBox
          title="Bạn chưa đăng ký gói dịch vụ"
          description="Đăng ký gói Pro trở lên (hoặc dùng thử Fun Free 7 ngày) để xem thống kê doanh thu, biểu đồ và top món bán chạy."
        />
      ) : (
        <SectionCard title="Doanh thu hôm nay" icon={TrendingUp}>
          <div className="text-3xl font-bold text-bean">{formatCurrency(todayRevenue)}</div>
          <p className="text-cafe-500 text-sm mt-1">Từ {todayInvoicesCount} hóa đơn hôm nay</p>
          <Link href="/user/revenue" className="inline-flex items-center gap-1 text-sm font-semibold text-bean mt-4 hover:gap-2 transition-all">
            Xem báo cáo chi tiết <ArrowRight className="w-4 h-4" />
          </Link>
        </SectionCard>
      )}
    </div>
  );
}
