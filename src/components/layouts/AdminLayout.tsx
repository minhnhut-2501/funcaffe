'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import {
  Coffee, LayoutDashboard, Users, Package, CreditCard,
  BarChart3, LogOut, Menu, X, Bell, Search, DollarSign,
  Star, PanelLeft, ShieldCheck, Mail as MailIcon,
} from 'lucide-react';
import { authService, paymentService, userService } from '@/services';
import { useAuth } from '@/context/AuthContext';

const navGroups: { title: string; items: { href: string; label: string; icon: typeof Coffee }[] }[] = [
  {
    title: 'Hệ thống',
    items: [
      { href: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/admin/users', label: 'Quản lý user', icon: Users },
    ],
  },
  {
    title: 'Gói & thanh toán',
    items: [
      { href: '/admin/packages', label: 'Gói dịch vụ', icon: Package },
      { href: '/admin/payments', label: 'Quản lý thanh toán', icon: CreditCard },
    ],
  },
  {
    title: 'Thống kê',
    items: [
      { href: '/admin/reviews', label: 'Đánh giá', icon: Star },
      { href: '/admin/revenue', label: 'Doanh thu hệ thống', icon: BarChart3 },
    ],
  },
  {
    title: 'Hỗ trợ',
    items: [
      { href: '/admin/contacts', label: 'Tin nhắn liên hệ', icon: MailIcon },
    ],
  },
];

const searchRoutes: Record<string, string> = {
  user: '/admin/users', users: '/admin/users', 'người dùng': '/admin/users', 'tài khoản': '/admin/users',
  payment: '/admin/payments', payments: '/admin/payments', 'thanh toán': '/admin/payments', 'giao dịch': '/admin/payments',
  package: '/admin/packages', packages: '/admin/packages', 'gói': '/admin/packages', 'dịch vụ': '/admin/packages',
  revenue: '/admin/revenue', 'doanh thu': '/admin/revenue', 'thống kê': '/admin/revenue',
  dashboard: '/admin/dashboard', 'tổng quan': '/admin/dashboard',
  review: '/admin/reviews', reviews: '/admin/reviews', 'đánh giá': '/admin/reviews',
  contact: '/admin/contacts', contacts: '/admin/contacts', 'liên hệ': '/admin/contacts', 'tin nhắn': '/admin/contacts',
};

function AdminSidebar({ collapsed, mobileOpen, onClose, onToggle }: { collapsed: boolean; mobileOpen: boolean; onClose: () => void; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

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

      {!collapsed ? (
        <div className="mx-3 mt-3 rounded-xl border border-line bg-white p-3 shadow-soft flex items-center gap-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-bean shrink-0" />
          <span className="text-xs text-cafe-600 font-semibold tracking-wide">Quản trị hệ thống</span>
        </div>
      ) : (
        <button onClick={onToggle} className="hidden md:grid place-items-center text-cafe-400 hover:text-bean hover:bg-sand w-9 h-9 rounded-lg mx-auto mt-3 transition-colors" title="Mở rộng">
          <PanelLeft className="w-4 h-4 rotate-180" />
        </button>
      )}

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

      <div className="px-2.5 py-3 border-t border-line shrink-0">
        <button onClick={handleLogout} className={`sidebar-item w-full text-red-600 hover:bg-red-50 ${collapsed ? 'justify-center px-0' : ''}`} title={collapsed ? 'Đăng xuất' : undefined}>
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
}

function AdminTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; type: string; message: string; href: string }[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      paymentService.list().catch(() => []),
      userService.list().catch(() => []),
    ]).then(([payments]) => {
      const items: typeof notifications = [];
      payments.forEach((p: any) => {
        if (p.status === 'pending') {
          items.push({ id: p.id, type: 'payment', message: `Yêu cầu thanh toán từ ${p.userName}`, href: '/admin/payments' });
        }
      });
      items.sort((a, b) => a.id.localeCompare(b.id));
      setNotifications(items.slice(0, 10));
    });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const q = searchText.toLowerCase().trim();
    for (const [key, route] of Object.entries(searchRoutes)) {
      if (q.includes(key)) { router.push(route); setSearchText(''); return; }
    }
  };

  return (
    <header className="bg-paper/85 backdrop-blur-md border-b border-line px-4 sm:px-6 h-16 flex items-center gap-3 sticky top-0 z-30">
      <button onClick={onMenuClick} className="md:hidden grid place-items-center text-cafe-500 hover:text-bean hover:bg-sand w-9 h-9 rounded-lg -ml-1" aria-label="Mở menu">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cafe-400 pointer-events-none" />
          <input
            placeholder="Tìm nhanh: user, thanh toán, gói..."
            className="input-funcafe !pl-10 py-2 text-sm"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative" ref={notifRef}>
          <button onClick={() => setShowNotifications(!showNotifications)} className="relative grid place-items-center w-9 h-9 rounded-lg text-cafe-500 hover:text-bean hover:bg-sand transition-colors" aria-label="Thông báo">
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-paper" />
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-line shadow-pop z-40 max-h-80 overflow-y-auto">
              <div className="px-4 py-3 border-b border-line">
                <p className="text-sm font-bold text-ink">Thông báo</p>
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-cafe-400 text-sm">Không có thông báo mới</div>
              ) : (
                notifications.map(n => (
                  <Link key={n.id} href={n.href} onClick={() => setShowNotifications(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-sand border-b border-line/60 last:border-0">
                    <div className="w-9 h-9 bg-gold/18 rounded-xl flex items-center justify-center shrink-0">
                      <DollarSign className="w-4 h-4 text-gold-deep" />
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
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-ink leading-tight">{user?.fullName ?? 'Admin'}</p>
            <p className="text-xs text-cafe-400">Quản trị viên</p>
          </div>
          <div className="w-9 h-9 bg-bean rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm shrink-0 ring-2 ring-white shadow-soft">
            {!user ? <span className="w-full h-full animate-pulse bg-bean-dark/40" /> : user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : (user.fullName?.charAt(0)?.toUpperCase() ?? 'A')}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // ROUTE GUARD: khu vực /admin/* chỉ dành cho role 'admin'.
  // Chưa đăng nhập -> /login; user thường -> về dashboard user.
  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'admin') router.replace('/user/dashboard');
  }, [isLoading, user, router]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (isLoading || !user || user.role !== 'admin') return null;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {mobileOpen && <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />}
      <AdminSidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AdminTopbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
