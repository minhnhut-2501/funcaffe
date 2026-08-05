'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Coffee, LayoutDashboard, Store, Grid3X3, UtensilsCrossed,
  CupSoda, ShoppingCart, Receipt,
  BarChart3, CreditCard, User, LogOut, Menu, X, Bell, Clock, PanelLeft,
  ChevronDown, Check, Plus, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isSubscriptionExpired, expiryState, daysLeftUntil, EXPIRY_SOON_DAYS, type ExpiryState } from '@/lib/permission';
import { invoiceService } from '@/services';
import type { CafeInfo } from '@/types';
import AiChatWidget from '@/components/user/AiChatWidget';
import SidebarNav, { type NavGroup } from '@/components/layouts/SidebarNav';

const navGroups: NavGroup[] = [
  {
    title: 'Vận hành',
    items: [
      { href: '/user/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/user/tables', label: 'Quản lý bàn', icon: Grid3X3 },
      { href: '/user/menu', label: 'Thực đơn', icon: UtensilsCrossed },
      { href: '/user/toppings', label: 'Topping', icon: CupSoda },
    ],
  },
  {
    title: 'Bán hàng',
    items: [
      { href: '/user/sales', label: 'Bán hàng', icon: ShoppingCart },
      { href: '/user/invoices', label: 'Hóa đơn', icon: Receipt },
    ],
  },
  {
    title: 'Báo cáo & gói',
    items: [
      { href: '/user/revenue', label: 'Doanh thu', icon: BarChart3 },
      { href: '/user/subscription', label: 'Gói đang dùng', icon: CreditCard },
    ],
  },
  {
    title: 'Tài khoản',
    items: [
      { href: '/user/cafe', label: 'Quản lý quán', icon: Store },
      { href: '/user/profile', label: 'Hồ sơ cá nhân', icon: User },
    ],
  },
];

const packageMeta: Record<string, { label: string; cls: string }> = {
  none:   { label: 'Chưa có gói', cls: 'bg-cafe-100 text-cafe-500' },
  free:   { label: 'Fun Free',    cls: 'bg-blue-100 text-blue-700' },
  pro:    { label: 'Pro',         cls: 'bg-bean-tint text-bean' },
  promax: { label: 'Pro Max',     cls: 'bg-bean text-white' },
};

function PackageBadge({ type }: { type: string }) {
  const m = packageMeta[type] ?? packageMeta.none;
  return <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${m.cls}`}>{m.label}</span>;
}

/**
 * Các quán cần chú ý về hạn gói, quán ĐÃ hết xếp trước quán sắp hết.
 * Dùng chung cho chuông và cho chấm cảnh báo ở dropdown chuyển quán, để hai chỗ
 * không bao giờ nói khác nhau.
 */
function cafesNeedingAttention(cafes: CafeInfo[]) {
  return cafes
    .map((c) => ({ cafe: c, state: expiryState(c.packageEndDate) }))
    .filter((x): x is { cafe: CafeInfo; state: 'soon' | 'expired' } => x.state === 'soon' || x.state === 'expired')
    .sort((a, b) => (a.state === b.state ? 0 : a.state === 'expired' ? -1 : 1));
}

/** Chấm cảnh báo cạnh tên quán: đỏ = đã hết hạn, hổ phách = sắp hết. */
function ExpiryDot({ state, className = '' }: { state: ExpiryState; className?: string }) {
  if (state !== 'soon' && state !== 'expired') return null;
  const expired = state === 'expired';
  return (
    <span
      aria-hidden
      title={expired ? 'Gói đã hết hạn' : 'Gói sắp hết hạn'}
      className={`w-2 h-2 rounded-full shrink-0 ${expired ? 'bg-red-500' : 'bg-gold'} ${className}`}
    />
  );
}

function Sidebar({ collapsed, mobileOpen, onClose, onToggle, onLogout }: { collapsed: boolean; mobileOpen: boolean; onClose: () => void; onToggle: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const sub = user?.subscription;
  const handleLogout = onLogout;

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-[45] bg-[#FCFAF6] border-r border-line flex flex-col h-screen
        w-[17rem] ${collapsed ? 'md:w-[4.75rem]' : 'md:w-[17rem]'}
        transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        transition-[width,transform] duration-200 ease-out`}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-line shrink-0">
        <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={onClose}>
          <span className="w-9 h-9 bg-bean rounded-xl flex items-center justify-center shrink-0 shadow-soft">
            <Coffee className="w-[18px] h-[18px] text-white" />
          </span>
          {!collapsed && <span className="font-bold text-ink text-lg tracking-tight">FunCafe</span>}
        </Link>
        <button onClick={onClose} className="md:hidden text-cafe-400 hover:text-bean p-1 rounded-lg"><X className="w-5 h-5" /></button>
        {!collapsed && <button onClick={onToggle} className="hidden md:grid place-items-center text-cafe-400 hover:text-bean hover:bg-sand w-7 h-7 rounded-lg transition-colors" title="Thu gọn"><PanelLeft className="w-4 h-4" /></button>}
      </div>

      {/* Package tile */}
      {!collapsed && sub && (
        <div className="mx-3 mt-3 rounded-xl border border-line bg-white p-3 shadow-soft shrink-0">
          <div className="flex items-center justify-between gap-2">
            <PackageBadge type={sub.packageType} />
            {sub.packageType !== 'none' && (
              <span className={`text-[11px] font-medium ${isSubscriptionExpired(sub) ? 'text-red-600' : 'text-cafe-500'}`}>
                {isSubscriptionExpired(sub) ? 'Đã hết hạn' : `${sub.daysLeft} ngày còn lại`}
              </span>
            )}
          </div>
          {sub.packageType === 'none' && (
            <Link href="/user/subscription" onClick={onClose} className="mt-2.5 block text-center text-xs font-semibold bg-bean text-white rounded-lg py-1.5 hover:bg-bean-dark transition-colors">
              Kích hoạt gói
            </Link>
          )}
        </div>
      )}
      {collapsed && (
        <button onClick={onToggle} className="hidden md:grid place-items-center text-cafe-400 hover:text-bean hover:bg-sand w-9 h-9 rounded-lg mx-auto mt-3 transition-colors" title="Mở rộng">
          <PanelLeft className="w-4 h-4 rotate-180" />
        </button>
      )}

      {/* Nav */}
      <SidebarNav groups={navGroups} collapsed={collapsed} onNavigate={onClose} />

      {/* Logout */}
      <div className="px-2.5 py-3 border-t border-line shrink-0">
        <button onClick={handleLogout} className={`sidebar-item w-full text-red-600 hover:bg-red-50 ${collapsed ? 'justify-center px-0' : ''}`} title={collapsed ? 'Đăng xuất' : undefined}>
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
}

// ĐA QUÁN: dropdown chuyển quán đang quản lý + lối tắt thêm quán.
function CafeSwitcher() {
  const { cafes, activeCafeId, setActiveCafe } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const active = cafes.find((c) => c.id === activeCafeId);
  if (cafes.length === 0) return null;
  // Chấm trên chính nút mở dropdown: cảnh báo phải thấy được KHI ĐANG ĐÓNG, vì
  // quán sắp hết hạn thường là quán người dùng không đứng ở đó nên chẳng bao giờ mở ra.
  const needAttention = cafesNeedingAttention(cafes);
  const worst: ExpiryState = needAttention.some((x) => x.state === 'expired')
    ? 'expired'
    : needAttention.length > 0 ? 'soon' : 'ok';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 h-9 px-3 rounded-lg border border-line bg-white hover:bg-sand transition-colors max-w-[9rem] sm:max-w-[14rem]">
        <Store className="w-4 h-4 text-bean shrink-0" />
        <span className="text-sm font-semibold text-ink truncate">{active?.name ?? 'Chọn quán'}</span>
        <ExpiryDot state={worst} />
        <ChevronDown className="w-4 h-4 text-cafe-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl border border-line shadow-pop z-40 overflow-hidden anim-pop origin-top-left">
          <div className="px-4 py-2.5 border-b border-line text-[11px] font-semibold uppercase tracking-wider text-cafe-400">Quán của bạn</div>
          <div className="max-h-72 overflow-y-auto py-1">
            {cafes.map((c) => (
              <button
                key={c.id}
                onClick={async () => { await setActiveCafe(c.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-sand transition-colors ${c.id === activeCafeId ? 'bg-sand/60' : ''}`}
              >
                <Store className="w-4 h-4 text-bean shrink-0" />
                <span className="flex-1 text-sm text-ink truncate">{c.name}</span>
                <ExpiryDot state={expiryState(c.packageEndDate)} />
                {c.id === activeCafeId && <Check className="w-4 h-4 text-pine shrink-0" />}
              </button>
            ))}
          </div>
          <Link href="/user/cafe" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-3 border-t border-line text-sm font-semibold text-bean hover:bg-sand transition-colors">
            <Plus className="w-4 h-4" /> Thêm quán
          </Link>
        </div>
      )}
    </div>
  );
}

type Notif = { id: string; kind: 'invoice' | 'soon' | 'expired'; message: string; href: string };

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, activeCafeId, cafes } = useAuth();
  const sub = user?.subscription;
  const pathname = usePathname();
  const current = navGroups
    .flatMap((g) => g.items.map((it) => ({ ...it, group: g.title })))
    .find((it) => it.href === pathname);
  const shortName = user?.fullName.split(' ').slice(-1)[0] ?? '';
  const avatarChar = user?.fullName.charAt(0) ?? 'U';
  const [showNotif, setShowNotif] = useState(false);
  const [invoiceNotif, setInvoiceNotif] = useState<Notif[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoiceService.list().then(invoices => {
      const today = new Date().toDateString();
      const todayInvoices = (invoices ?? []).filter(inv => new Date(inv.createdAt).toDateString() === today);
      setInvoiceNotif(todayInvoices.length > 0
        ? [{ id: 'inv-today', kind: 'invoice', message: `Hôm nay có ${todayInvoices.length} hóa đơn mới`, href: '/user/invoices' }]
        : []);
    }).catch(() => {});
  }, [activeCafeId]);

  // Cảnh báo hạn gói của MỌI quán, không riêng quán đang chọn — quán bị bỏ quên
  // mới là quán dễ hết hạn mà không ai hay. Quán đã hết hạn xếp trên quán sắp hết.
  const expiryNotifs: Notif[] = cafesNeedingAttention(cafes).map(({ cafe, state }) => ({
    id: `exp-${cafe.id}`,
    kind: state,
    message: state === 'expired'
      ? `Gói của “${cafe.name}” đã hết hạn — quán đang ở chế độ chỉ xem`
      : `Gói của “${cafe.name}” còn ${daysLeftUntil(cafe.packageEndDate as string)} ngày`,
    href: '/user/subscription',
  }));

  const notifs: Notif[] = [...expiryNotifs, ...invoiceNotif];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="bg-paper/85 backdrop-blur-md border-b border-line px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-30">
      <button onClick={onMenuClick} className="md:hidden grid place-items-center text-cafe-500 hover:text-bean hover:bg-sand w-9 h-9 rounded-lg -ml-1" aria-label="Mở menu">
        <Menu className="w-5 h-5" />
      </button>

      {/* ĐA QUÁN: chọn quán đang quản lý */}
      <CafeSwitcher />

      {/* Breadcrumb trang hiện tại — lấp khoảng trống trái topbar + định hướng */}
      {current && (
        <nav aria-label="Vị trí" className="hidden lg:flex items-center gap-2 min-w-0">
          <current.icon className="w-4 h-4 text-bean shrink-0" />
          <span className="text-sm text-cafe-400">{current.group}</span>
          <span className="text-cafe-300" aria-hidden>/</span>
          <span className="text-sm font-semibold text-ink truncate">{current.label}</span>
        </nav>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative" ref={notifRef}>
          <button onClick={() => setShowNotif(!showNotif)} className="relative grid place-items-center w-9 h-9 rounded-lg text-cafe-500 hover:text-bean hover:bg-sand transition-colors" aria-label="Thông báo">
            <Bell className="w-5 h-5" />
            {/* Màu chấm theo mục nặng nhất: đỏ chỉ dành cho việc đang CHẶN bán hàng.
                Để hóa đơn mới cũng nổi chấm đỏ thì vài hôm là người dùng hết sợ màu đỏ. */}
            {notifs.length > 0 && (
              <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-paper ${
                notifs.some(n => n.kind === 'expired') ? 'bg-red-500'
                  : notifs.some(n => n.kind === 'soon') ? 'bg-gold'
                    : 'bg-bean'
              }`} />
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-line shadow-pop z-40 max-h-80 overflow-y-auto anim-pop origin-top-right">
              <div className="px-4 py-3 border-b border-line">
                <p className="text-sm font-bold text-ink">Thông báo</p>
              </div>
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center text-cafe-400 text-sm">Không có thông báo mới</div>
              ) : (
                notifs.map(n => {
                  // Ba loại thông báo phải phân biệt được ngay: hết hạn là việc chặn
                  // bán hàng, sắp hết hạn là việc cần làm sớm, hóa đơn chỉ là tin tức.
                  const look = n.kind === 'expired'
                    ? { box: 'bg-red-100 text-red-600', Icon: AlertTriangle }
                    : n.kind === 'soon'
                      ? { box: 'bg-gold/20 text-gold-deep', Icon: AlertTriangle }
                      : { box: 'bg-bean-tint text-bean', Icon: Clock };
                  return (
                    <Link key={n.id} href={n.href} onClick={() => setShowNotif(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-sand border-b border-line/60 last:border-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${look.box}`}>
                        <look.Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink/85 line-clamp-2">{n.message}</p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 pl-1">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-ink leading-tight">{shortName ? `Xin chào, ${shortName}` : 'Xin chào'}</p>
            {sub && (
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <PackageBadge type={sub.packageType} />
                {sub.packageType !== 'none' && (
                  <span className={`text-[11px] ${isSubscriptionExpired(sub) ? 'text-red-500' : 'text-cafe-400'}`}>
                    · {isSubscriptionExpired(sub) ? 'Đã hết hạn' : `${sub.daysLeft} ngày`}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-bean-tint flex items-center justify-center text-bean font-bold text-sm shrink-0 ring-2 ring-white shadow-soft">
            {!user ? <span className="w-full h-full animate-pulse bg-cafe-200" /> : user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : avatarChar}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, cafes, activeCafeId, logout } = useAuth();
  const hasPackage = user?.subscription.packageType !== 'none';
  const expired = isSubscriptionExpired(user?.subscription);
  // Sắp hết hạn của QUÁN ĐANG CHỌN. Các quán khác đã được chuông và chấm ở dropdown
  // lo — banner chiếm cả bề ngang nên chỉ dành cho quán người dùng đang làm việc.
  const activeExpiry = expiryState(user?.subscription?.endDate);
  const soon = hasPackage && activeExpiry === 'soon';

  // Đăng xuất phải nằm ở ĐÂY, cùng chỗ với route guard bên dưới. logout() xoá
  // `user`, guard thấy vậy liền bắn router.replace('/login') — tranh chấp với
  // lệnh về trang chủ. Cờ loggingOut cho guard biết đây là chủ động đăng xuất
  // chứ không phải truy cập trái phép, nên nó đứng yên.
  const loggingOut = useRef(false);
  const handleLogout = useCallback(async () => {
    loggingOut.current = true;
    // logout() dọn state ngay rồi mới chờ mạng, nên gọi router trong cùng nhịp:
    // React gộp hai việc vào một lần render, không có khoảnh khắc layout này bị
    // trả về null (màn hình trắng) trước khi trang chủ kịp hiện.
    const done = logout();
    // replace: đã đăng xuất thì nút Back không đưa lại được vào trang quản lý.
    router.replace('/');
    await done;
  }, [logout, router]);

  // ROUTE GUARD: khu vực /user/* yêu cầu đăng nhập với role 'user'.
  // Chưa đăng nhập -> /login; admin -> về dashboard admin.
  useEffect(() => {
    if (isLoading || loggingOut.current) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role === 'admin') router.replace('/admin/dashboard');
  }, [isLoading, user, router]);

  // đóng drawer mobile khi đổi trang
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // ĐA QUÁN: nếu user chưa có quán nào -> ép sang trang Quản lý quán để tạo quán đầu tiên.
  const [cafeReady, setCafeReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (isLoading || !user) return;
    if (pathname === '/user/cafe' || pathname === '/user/subscription') { setCafeReady(true); return; }
    if (cafes.length === 0) { router.replace('/user/cafe'); return; }
    setCafeReady(true);
  }, [pathname, router, isLoading, user, cafes]);

  // Chặn render khi chưa xác thực xong hoặc không đủ quyền (đang redirect)
  if (isLoading || !user || user.role !== 'user') return null;
  if (cafeReady === null) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {mobileOpen && <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 md:hidden anim-fade" onClick={() => setMobileOpen(false)} />}
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onToggle={() => setCollapsed(!collapsed)} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        {!hasPackage && (
          <div className="bg-gold/12 border-b border-gold/25 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-gold-deep">
              Bạn đang dùng thử. Một số chức năng bị giới hạn.{' '}
              <Link href="/user/subscription" className="font-semibold underline hover:text-bean">Kích hoạt gói ngay</Link>
            </p>
            <Link href="/user/subscription" className="text-xs font-semibold bg-gold/25 text-gold-deep px-3 py-1.5 rounded-full hover:bg-gold/35 transition-colors">
              Kích hoạt Fun Free
            </Link>
          </div>
        )}
        {soon && (
          <div className="bg-gold/12 border-b border-gold/25 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-gold-deep">
              Gói của quán này còn{' '}
              <span className="font-semibold">
                {user?.subscription?.endDate ? daysLeftUntil(user.subscription.endDate) : EXPIRY_SOON_DAYS} ngày
              </span>
              . Gia hạn trước khi hết để không phải dừng bán hàng.
            </p>
            <Link href="/user/subscription" className="text-xs font-semibold bg-gold/25 text-gold-deep px-3 py-1.5 rounded-full hover:bg-gold/35 transition-colors">
              Gia hạn ngay
            </Link>
          </div>
        )}
        {hasPackage && expired && (
          <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-red-700">
              Gói của bạn đã hết hạn — đang ở <span className="font-semibold">chế độ chỉ xem</span>. Bạn vẫn xem được dữ liệu và doanh thu; hãy gia hạn để thêm/sửa/bán hàng.
            </p>
            <Link href="/user/subscription" className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-full hover:bg-red-700 transition-colors">
              Gia hạn ngay
            </Link>
          </div>
        )}
        {/* ĐA QUÁN: đổi quán -> remount toàn bộ trang để mọi useApi nạp lại dữ liệu quán mới
            (tránh việc trang vẫn hiển thị dữ liệu quán cũ tới khi F5). */}
        <main key={activeCafeId ?? 'no-cafe'} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* key={pathname}: đổi trang là React thay key -> .anim-page chạy lại,
              nội dung mới nhô lên thay vì nhảy phắt vào chỗ. */}
          <div key={pathname} className="anim-page">{children}</div>
        </main>
      </div>
      <AiChatWidget />
    </div>
  );
}
