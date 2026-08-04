'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export type NavGroup = {
  title: string;
  items: { href: string; label: string; icon: LucideIcon }[];
};

/**
 * Điều hướng sidebar dùng chung cho khu user và khu admin (hai bên chỉ khác mảng
 * `groups`).
 *
 * Điểm đáng nói là cái PILL: nền xanh của mục đang mở không nằm trong từng mục
 * mà là một phần tử riêng, trượt từ mục cũ sang mục mới khi đổi trang. Đó là
 * chuyển động mang nghĩa — nó cho người dùng thấy họ vừa đi từ đâu sang đâu,
 * thay vì tắt chỗ này bật chỗ kia.
 */
export default function SidebarNav({
  groups,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  /** Đóng drawer trên mobile sau khi bấm. */
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  // Lần đo ĐẦU TIÊN không được có transition, nếu không thì mở trang nào pill
  // cũng bay một đường từ đỉnh nav xuống đúng mục — trông như lỗi.
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = activeRef.current;
      // Không mục nào khớp pathname (vd trang con) -> giấu pill đi, đừng để nó
      // mắc kẹt ở mục cũ và chỉ sai chỗ.
      if (!el) { setPill(null); return; }
      setPill({ top: el.offsetTop, height: el.offsetHeight });
    };
    measure();
    // Bật transition ở khung hình KẾ TIẾP, sau khi vị trí đầu đã vẽ xong.
    const id = requestAnimationFrame(() => setReady(true));

    const nav = navRef.current;
    if (!nav) return () => cancelAnimationFrame(id);
    // Sidebar co/giãn, xoay màn hình, đổi bề rộng cửa sổ đều làm mục xê dịch.
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, [pathname, collapsed, groups]);

  return (
    <nav ref={navRef} className="relative flex-1 px-2.5 py-3 overflow-y-auto">
      {/* Pill nằm trong chính vùng cuộn nên `offsetTop` vẫn đúng khi nav bị cuộn. */}
      <span
        aria-hidden
        className="absolute inset-x-2.5 top-0 rounded-xl bg-bean shadow-soft pointer-events-none"
        style={{
          height: pill?.height ?? 0,
          transform: `translateY(${pill?.top ?? 0}px)`,
          opacity: pill ? 1 : 0,
          transition: ready
            ? 'transform .28s var(--ease-out-expo), height .28s var(--ease-out-expo), opacity .15s linear'
            : 'none',
        }}
      />

      {groups.map((group) => (
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
                  ref={active ? activeRef : undefined}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
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
  );
}
