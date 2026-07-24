'use client';
import Link from 'next/link';
import {
  ShoppingCart, UtensilsCrossed, Receipt, TrendingUp, TrendingDown, Users,
  ClipboardList, CreditCard, AlertCircle, ArrowRight, ArrowUpRight, Sparkles, Zap,
} from 'lucide-react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { useAuth } from '@/context/AuthContext';
import { invoiceService, orderService, tableService } from '@/services';
import { useApi } from '@/hooks/use-api';
import { isSubscriptionExpired } from '@/lib/permission';
import { formatCurrency } from '@/lib/format';

const quickActions = [
  { href: '/user/sales', icon: ShoppingCart, label: 'Tạo order mới', desc: 'Mở màn bán hàng' },
  { href: '/user/menu', icon: UtensilsCrossed, label: 'Quản lý thực đơn', desc: 'Món, size, topping' },
  { href: '/user/invoices', icon: Receipt, label: 'Xem hóa đơn', desc: 'Lịch sử thanh toán' },
  { href: '/user/subscription', icon: CreditCard, label: 'Gói dịch vụ', desc: 'Nâng cấp / gia hạn' },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function dayLabel(): string {
  const d = new Date();
  const weekday = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][d.getDay()];
  return `${weekday}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function DashboardPage() {
  const { user, cafes, activeCafeId } = useAuth();
  const sub = user?.subscription;
  const cafeName = cafes.find(c => c.id === activeCafeId)?.name;
  const firstName = user?.fullName?.split(' ').slice(-1)[0] ?? '';

  const { data: invoices, loading: loadingInv, error: errorInv } = useApi(() => invoiceService.list());
  const { data: orders, loading: loadingOrd, error: errorOrd } = useApi(() => orderService.list());
  const { data: tables, loading: loadingTbl, error: errorTbl } = useApi(() => tableService.list());

  const activeOrders = orders?.filter(o => o.status === 'active').length ?? 0;
  const now = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = iso(now);
  const yStr = iso(new Date(now.getTime() - 86400000));

  const paid = (invoices ?? []).filter(i => i.status === 'paid');
  const revOn = (day: string) => paid.filter(i => (i.paidAt || i.createdAt)?.startsWith(day)).reduce((s, i) => s + i.totalAmount, 0);
  const todayRevenue = revOn(todayStr);
  const yesterdayRevenue = revOn(yStr);
  const todayInvoicesCount = (invoices ?? []).filter(i => (i.paidAt || i.createdAt)?.startsWith(todayStr)).length;
  const totalTables = tables?.length ?? 0;
  const availableTables = tables?.filter(t => t.status === 'empty').length ?? 0;

  const delta = yesterdayRevenue > 0 ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : null;
  const up = (delta ?? 0) >= 0;

  if (loadingInv || loadingOrd || loadingTbl) {
    return (
      <div className="max-w-6xl">
        <div className="h-24 rounded-3xl bg-sand animate-pulse mb-6" />
        <LoadingSkeleton variant="card" rows={4} />
      </div>
    );
  }

  if (errorInv || errorOrd || errorTbl) {
    return (
      <div className="max-w-6xl">
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5" />
          <span>Không thể tải dữ liệu. Vui lòng thử lại sau.</span>
        </div>
      </div>
    );
  }

  const expired = isSubscriptionExpired(sub);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Lời chào + gói + CTA */}
      <section className="relative overflow-hidden rounded-3xl bg-bean text-white shadow-card px-6 py-6 sm:px-8 sm:py-7">
        {/* Vệt sáng trang trí */}
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="min-w-0">
            <p className="text-white/70 text-sm">{dayLabel()}</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
              {greeting()}{firstName ? `, ${firstName}` : ''} <span className="inline-block">👋</span>
            </h1>
            <p className="text-white/80 text-sm mt-1.5 flex items-center gap-1.5">
              {cafeName ? <>Đang quản lý <span className="font-semibold text-white">{cafeName}</span></> : 'Chúc bạn một ngày buôn may bán đắt!'}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/12 backdrop-blur px-4 py-2.5">
              <Sparkles className="w-5 h-5 text-gold shrink-0" />
              <div className="leading-tight">
                <p className="text-[11px] text-white/70">Gói hiện tại</p>
                <p className="text-sm font-bold">
                  {sub?.packageName}
                  {sub?.packageType !== 'none' && <span className="font-normal text-white/70"> · {expired ? 'Hết hạn' : `${sub?.daysLeft} ngày`}</span>}
                </p>
              </div>
            </div>
            <Link href="/user/sales" className="inline-flex items-center gap-2 bg-white text-bean font-semibold px-4 py-2.5 rounded-2xl shadow-soft hover:bg-white/90 active:scale-[.98] transition">
              <ShoppingCart className="w-4 h-4" />Bán hàng
            </Link>
          </div>
        </div>
      </section>

      {expired && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />Gói của quán đã hết hạn — đang ở chế độ chỉ xem.</span>
          <Link href="/user/subscription" className="font-semibold underline">Gia hạn ngay</Link>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Doanh thu — nổi bật, bấm để xem báo cáo */}
        <Link href="/user/revenue" className="group rounded-2xl bg-bean text-white shadow-card p-4 sm:p-5 flex flex-col lift">
          <div className="flex items-start justify-between">
            <span className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center"><TrendingUp className="w-5 h-5" /></span>
            {delta !== null ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">
                {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(delta)}%
              </span>
            ) : (
              <ArrowUpRight className="w-4 h-4 text-white/70 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            )}
          </div>
          <p className="text-2xl font-bold mt-3 tabular-nums truncate">{formatCurrency(todayRevenue)}</p>
          <p className="text-xs text-white/75 mt-0.5">
            Doanh thu hôm nay{delta !== null ? ` · ${up ? 'tăng' : 'giảm'} so hôm qua` : ` · ${todayInvoicesCount} hóa đơn`}
          </p>
        </Link>

        <KpiTile icon={ClipboardList} tone="pine" value={activeOrders} label="Order đang hoạt động" />
        <KpiTile icon={Users} tone="bean" value={`${availableTables}/${totalTables}`} label="Bàn trống" />
        <KpiTile icon={Receipt} tone="gold" value={todayInvoicesCount} label="Hóa đơn hôm nay" />
      </div>

      {/* Lối tắt */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-bean" />
          <h2 className="text-base font-bold text-ink">Lối tắt</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {quickActions.map((a) => (
            <Link key={a.href} href={a.href} className="group rounded-2xl bg-white border border-line p-4 shadow-soft transition-all duration-200 hover:shadow-card hover:-translate-y-0.5 hover:border-bean/40">
              <div className="flex items-center justify-between">
                <span className="w-11 h-11 rounded-xl bg-bean-tint text-bean grid place-items-center transition-transform group-hover:scale-105">
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
    </div>
  );
}

function KpiTile({ icon: Icon, tone, value, label }: { icon: typeof Users; tone: 'bean' | 'pine' | 'gold'; value: string | number; label: string }) {
  const toneCls = tone === 'pine' ? 'bg-pine/12 text-pine' : tone === 'gold' ? 'bg-gold/15 text-gold-deep' : 'bg-bean-tint text-bean';
  return (
    <div className="rounded-2xl border border-line bg-white shadow-soft p-4 sm:p-5 flex flex-col lift">
      <span className={`w-10 h-10 rounded-xl grid place-items-center ${toneCls}`}><Icon className="w-5 h-5" /></span>
      <p className="text-2xl font-bold text-ink mt-3 tabular-nums truncate">{value}</p>
      <p className="text-xs text-cafe-500 mt-0.5">{label}</p>
    </div>
  );
}
