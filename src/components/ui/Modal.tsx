'use client';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import React from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Hàng nút hành động. Nằm NGOÀI vùng cuộn nên luôn thấy được, dù nội dung dài. */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export default function Modal({ open, onClose, title, children, footer, size = 'md' }: Props) {
  // Portal chỉ dựng được sau khi đã ở trên trình duyệt (server không có document).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    // Chỉ khóa <body>. KHÔNG khóa <main class="overflow-y-auto"> dù nó mới là vùng
    // cuộn của khu quản lý: modal nay nằm trong <body> qua portal nên <main> không
    // còn là tổ tiên của nó — lăn chuột trên modal không với tới <main> được nữa.
    // Mà đặt overflow:hidden cho <main> lại có hại thật: Chrome đưa scrollTop của nó
    // về 0, nên đang xem dòng thứ 80 của bảng mà bấm "xem chi tiết" là cả danh sách
    // nhảy về đầu, đóng modal ra thì mất chỗ đang đọc.
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Đưa thẳng ra <body>: modal thoát mọi ancestor nên `position: fixed` bám màn
  // hình thật. Nếu để tại chỗ, chỉ cần một ancestor có transform (kể cả ma trận
  // đơn vị do animation để lại) là modal bị căn giữa theo nội dung trang và lớp
  // nền mờ không phủ hết được sidebar.
  return createPortal(
    // Khi IN: gỡ hết giới hạn chiều cao và vùng cuộn của hộp thoại.
    //
    // Nội dung cần in (.print-area) nằm trong khung cuộn `overflow-y-auto`, mà khung
    // đó lại nằm giữa nó và khối định vị `relative` bao ngoài — nên dù .print-area
    // được đặt position:absolute, nó vẫn bị khung cuộn cắt. Hậu quả: hóa đơn dài quá
    // 90vh thì bản in mất phần dưới, mà trên màn hình vẫn thấy đủ nên rất khó phát hiện.
    <div className="print-root fixed inset-0 z-[60] flex items-center justify-center p-4 print:static print:block print:p-0">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm anim-fade print:hidden" onClick={onClose} />
      <div className={`relative bg-white rounded-3xl shadow-pop w-full ${sizeMap[size]} max-h-[90vh] flex flex-col anim-pop print:static print:max-h-none print:max-w-none print:shadow-none print:rounded-none print:block`}>
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-lg text-cafe-400 hover:text-bean hover:bg-sand transition-colors" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 print:overflow-visible print:p-0">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line px-6 py-4 bg-white rounded-b-3xl">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
