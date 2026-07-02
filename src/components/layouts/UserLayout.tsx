'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import {
  Coffee, LayoutDashboard, Store, Grid3X3, UtensilsCrossed,
  CupSoda, Settings, ShoppingCart, Receipt,
  BarChart3, CreditCard, User, LogOut, Menu, X, Bell, Clock, PanelLeft,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { invoiceService, authService, hasCafe } from '@/services';

const navGroups: { title: string; items: { href: string; label: string; icon: typeof Coffee }[] }[] = [
  {
    title: 'Vận hành',
    items: [
      { href: '/user/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/user/cafe', label: 'Thông tin quán', icon: Store },
      { href: '/user/tables', label: 'Quản lý bàn', icon: Grid3X3 },
      { href: '/user/menu', label: 'Thực đơn', icon: UtensilsCrossed },
      { href: '/user/toppings', label: 'Topping', icon: CupSoda },
      { href: '/user/item-toppings', label: 'Cấu hình topping', icon: Settings },
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

function Sidebar({ collapsed, mobileOpen, onClose, onToggle }: { collapsed: boolean; mobileOpen: boolean; onClose: () => void; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const sub = user?.subscription;

  const handleLogout = async () => {
    try { await authService.logout(); } catch {}
    router.push('/');
  };

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
              <span className="text-[11px] text-cafe-500 font-medium">{sub.daysLeft} ngày còn lại</span>
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
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-cafe-400">{group.title}</p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`sidebar-item ${active ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

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

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();
  const sub = user?.subscription;
  const pathname = usePathname();
  const current = navGroups
    .flatMap((g) => g.items.map((it) => ({ ...it, group: g.title })))
    .find((it) => it.href === pathname);
  const shortName = user?.fullName.split(' ').slice(-1)[0] ?? '';
  const avatarChar = user?.fullName.charAt(0) ?? 'U';
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<{ id: string; type: string; message: string; href: string }[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoiceService.list().then(invoices => {
      const today = new Date().toDateString();
      const todayInvoices = (invoices ?? []).filter(inv => new Date(inv.createdAt).toDateString() === today);
      if (todayInvoices.length > 0) {
        setNotifs([{ id: 'inv-today', type: 'invoice', message: `Hôm nay có ${todayInvoices.length} hóa đơn mới`, href: '/user/invoices' }]);
      }
    }).catch(() => {});
  }, []);

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

      {/* Breadcrumb trang hiện tại — lấp khoảng trống trái topbar + định hướng */}
      {current && (
        <nav aria-label="Vị trí" className="hidden sm:flex items-center gap-2 min-w-0">
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
            {notifs.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-paper" />
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-line shadow-pop z-40 max-h-80 overflow-y-auto">
              <div className="px-4 py-3 border-b border-line">
                <p className="text-sm font-bold text-ink">Thông báo</p>
              </div>
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center text-cafe-400 text-sm">Không có thông báo mới</div>
              ) : (
                notifs.map(n => (
                  <Link key={n.id} href={n.href} onClick={() => setShowNotif(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-sand border-b border-line/60 last:border-0">
                    <div className="w-9 h-9 bg-bean-tint rounded-xl flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-bean" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink/85 line-clamp-2">{n.message}</p>
                    </div>
                  </Link>
                ))
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
                  <span className="text-[11px] text-cafe-400">· {sub.daysLeft} ngày</span>
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
  const { user } = useAuth();
  const hasPackage = user?.subscription.packageType !== 'none';

  // đóng drawer mobile khi đổi trang
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const [cafeReady, setCafeReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (pathname === '/user/cafe' || pathname === '/user/subscription') { setCafeReady(true); return; }
    hasCafe().then(exists => {
      if (!exists) { router.replace('/user/cafe'); return; }
      setCafeReady(true);
    });
  }, [pathname, router]);

  if (cafeReady === null) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {mobileOpen && <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />}
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onToggle={() => setCollapsed(!collapsed)} />
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
