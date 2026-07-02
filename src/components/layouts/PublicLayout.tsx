'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coffee, Menu, X, Mail, Phone, MapPin, LayoutDashboard } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const navLinks = [
  { href: '/', label: 'Trang chủ' },
  { href: '/pricing', label: 'Phí dịch vụ' },
  { href: '/support', label: 'Hỗ trợ' },
  { href: '/contact', label: 'Liên hệ' },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-bean focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Bỏ qua tới nội dung chính
      </a>
      <PublicHeader />
      <main id="main" className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-8 h-8 bg-bean rounded-lg flex items-center justify-center">
        <Coffee className="w-5 h-5 text-white" />
      </span>
      <span className={`text-lg font-bold ${light ? 'text-white' : 'text-ink'}`}>FunCafe</span>
    </span>
  );
}

function PublicHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const dashboardHref = user?.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-line sticky top-0 z-50 shadow-[0_1px_12px_-6px_rgba(15,23,42,0.18)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/"><Logo /></Link>

          <nav className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  pathname === link.href
                    ? 'text-bean font-semibold'
                    : 'text-ink/70 hover:text-bean font-medium'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link href={dashboardHref} className="flex items-center gap-1.5 text-sm font-medium text-ink/80 hover:text-bean transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  Vào quản lý
                </Link>
                <span className="text-sm text-ink/40">|</span>
                <span className="text-sm font-medium text-ink/70 max-w-[140px] truncate" title={user.fullName}>
                  {user.fullName}
                </span>
                <button onClick={logout} className="btn-cafe-outline py-2 px-4">
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-ink/80 hover:text-bean transition-colors">
                  Đăng nhập
                </Link>
                <Link href="/register" className="btn-cafe py-2 px-4">
                  Dùng thử miễn phí
                </Link>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2 text-bean"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Mở menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-line px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                pathname === link.href ? 'bg-paper text-bean' : 'text-ink/80 hover:bg-paper'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2 border-t border-line mt-2">
            {user ? (
              <>
                <span className="px-3 py-1 text-sm text-ink/60 truncate">Xin chào, {user.fullName}</span>
                <Link href={dashboardHref} onClick={() => setMobileOpen(false)} className="btn-cafe">Vào quản lý</Link>
                <button onClick={() => { setMobileOpen(false); logout(); }} className="btn-cafe-outline">Đăng xuất</button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-cafe-outline">Đăng nhập</Link>
                <Link href="/register" onClick={() => setMobileOpen(false)} className="btn-cafe">Dùng thử miễn phí</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="bg-ink-deep text-white/70">
      <div className="h-1 bg-gradient-to-r from-bean via-gold to-pine" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Logo light />
            <p className="text-sm leading-relaxed mt-3 text-white/60">
              Phần mềm quản lý quán cafe cho chủ quán nhỏ và vừa: quản lý bàn, thực đơn,
              order, hóa đơn và doanh thu trong một nơi.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3 text-sm">Sản phẩm</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/pricing" className="hover:text-white transition-colors">Phí dịch vụ</Link></li>
              <li><Link href="/support" className="hover:text-white transition-colors">Hướng dẫn sử dụng</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3 text-sm">Hỗ trợ</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/support" className="hover:text-white transition-colors">Trung tâm hỗ trợ</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Liên hệ</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors">Đăng nhập</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3 text-sm">Liên hệ</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Mail className="w-4 h-4 shrink-0" /> support@funcafe.vn</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" /> 1900 1234</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" /> TP. Hồ Chí Minh</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-white/50">
          <p>© 2025 FunCafe. Đồ án tốt nghiệp.</p>
          <p>Phần mềm quản lý quán cafe</p>
        </div>
      </div>
    </footer>
  );
}
