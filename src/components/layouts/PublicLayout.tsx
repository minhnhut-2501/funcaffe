'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coffee, Menu, X, Mail, Phone, MapPin, LayoutDashboard } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const navLinks = [
  { href: '/', label: 'Trang chủ' },
  { href: '/features', label: 'Tính năng' },
  { href: '/pricing', label: 'Phí dịch vụ' },
  { href: '/support', label: 'Hỗ trợ' },
  { href: '/contact', label: 'Liên hệ' },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-toast focus:rounded-lg focus:bg-bean focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Bỏ qua tới nội dung chính
      </a>
      <PublicHeader />
      {/* min-w-0: chặn sẵn kiểu lỗi "flex item bị nội dung rộng kéo giãn" khiến
          cả trang cuộn ngang trên điện thoại (bảng rộng, ảnh, khối pre...). */}
      <main id="main" className="flex-1 min-w-0">{children}</main>
      <PublicFooter />
    </div>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-8 h-8 bg-bean rounded-lg flex items-center justify-center shrink-0">
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

  // Đóng menu khi điều hướng sang trang khác (Link push không unmount header).
  useEffect(() => setMobileOpen(false), [pathname]);

  // Khi drawer mở: khoá cuộn nền + đóng bằng phím Esc.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-line sticky top-0 z-sticky shadow-[0_1px_12px_-6px_rgba(15,23,42,0.18)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" aria-label="FunCafe — về trang chủ" className="shrink-0">
            <Logo />
          </Link>

          <nav aria-label="Điều hướng chính" className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'text-bean font-semibold'
                      : 'text-ink/75 hover:text-bean hover:bg-bean-tint font-medium'
                  }`}
                >
                  {link.label}
                  {/* Gạch chân: trạng thái hiện tại không chỉ dựa vào màu (WCAG 1.4.1) */}
                  {active && (
                    <span aria-hidden className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-bean" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            {user ? (
              <>
                <Link href={dashboardHref} className="flex items-center gap-1.5 text-sm font-medium text-ink/80 hover:text-bean transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  Vào quản lý
                </Link>
                <span aria-hidden className="h-4 w-px bg-line" />
                <span className="text-sm font-medium text-ink/75 max-w-[140px] truncate" title={user.fullName}>
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
            type="button"
            className="md:hidden -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-bean hover:bg-bean-tint transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Nền mờ phía sau drawer: bấm ra ngoài để đóng */}
      {mobileOpen && (
        <div
          aria-hidden
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 top-16 z-drawer-backdrop bg-ink-deep/25 backdrop-blur-[2px]"
        />
      )}

      <div
        id="mobile-nav"
        hidden={!mobileOpen}
        className="md:hidden relative z-drawer bg-white border-t border-line px-4 py-3 shadow-card max-h-[calc(100vh-4rem)] overflow-y-auto"
      >
        <nav aria-label="Điều hướng chính (di động)" className="space-y-1">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center px-3 rounded-xl text-sm font-medium ${
                  active ? 'bg-bean-tint text-bean' : 'text-ink/80 hover:bg-paper'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="pt-3 mt-3 flex flex-col gap-2 border-t border-line">
          {user ? (
            <>
              <span className="px-3 pb-1 text-sm text-ink/70 truncate">Xin chào, {user.fullName}</span>
              <Link href={dashboardHref} onClick={() => setMobileOpen(false)} className="btn-cafe py-3">Vào quản lý</Link>
              <button onClick={() => { setMobileOpen(false); logout(); }} className="btn-cafe-outline py-3">Đăng xuất</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-cafe-outline py-3">Đăng nhập</Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="btn-cafe py-3">Dùng thử miễn phí</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink-deep text-white/70">
      <div className="h-1 bg-gradient-to-r from-bean via-gold to-pine" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Logo light />
            <p className="text-sm leading-relaxed mt-3 text-white/65 max-w-xs">
              Phần mềm quản lý quán cafe cho chủ quán nhỏ và vừa: quản lý bàn, thực đơn,
              order, hóa đơn và doanh thu trong một nơi.
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-3 text-sm">Sản phẩm</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href="/features" className="hover:text-white transition-colors">Tính năng</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Phí dịch vụ</Link></li>
              <li><Link href="/register" className="hover:text-white transition-colors">Dùng thử miễn phí</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-3 text-sm">Hỗ trợ</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href="/support" className="hover:text-white transition-colors">Hướng dẫn sử dụng</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Liên hệ tư vấn</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors">Đăng nhập</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-3 text-sm">Liên hệ</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="mailto:support@funcafe.vn" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail className="w-4 h-4 shrink-0" aria-hidden /> support@funcafe.vn
                </a>
              </li>
              <li>
                <a href="tel:19001234" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone className="w-4 h-4 shrink-0" aria-hidden /> 1900 1234
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" aria-hidden /> TP. Hồ Chí Minh
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-white/55">
          <p>© {year} FunCafe. Đồ án tốt nghiệp.</p>
          <p>Phần mềm quản lý quán cafe</p>
        </div>
      </div>
    </footer>
  );
}
