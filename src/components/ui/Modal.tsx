'use client';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import React from 'react';

/** Những thứ nhận được tiêu điểm bàn phím bên trong hộp thoại. */
const O_NHAN_TIEU_DIEM =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  const hopRef = useRef<HTMLDivElement>(null);
  const tieuDe = useId();

  // Nơi gọi truyền `onClose={() => setOpen(false)}` — một hàm MỚI mỗi lượt vẽ. Để nó
  // trong danh sách phụ thuộc thì effect dưới đây tháo ra lắp lại liên tục, và mỗi lần
  // tháo là hàm dọn dẹp trả tiêu điểm về nút mở — tức là gõ một chữ vào ô trong hộp
  // thoại cũng đủ để tiêu điểm nhảy ra ngoài. Giữ hàm trong ref, effect chỉ phụ thuộc
  // `open`.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    // Nhớ chỗ đang đứng để trả tiêu điểm về đó lúc đóng. Không có bước này, đóng
    // hộp thoại xong tiêu điểm rơi về đầu trang: người dùng bàn phím phải Tab lại
    // từ đầu mới quay được về nút vừa bấm.
    const noiXuatPhat = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      // Giữ vòng Tab bên trong hộp thoại. Thiếu nó, Tab đi tiếp xuống các nút của
      // trang nền đang bị lớp mờ che — bấm Enter vào một nút mình không nhìn thấy.
      const items = hopRef.current?.querySelectorAll<HTMLElement>(O_NHAN_TIEU_DIEM);
      if (!items || items.length === 0) return;
      const dau = items[0];
      const cuoi = items[items.length - 1];
      if (e.shiftKey && document.activeElement === dau) { e.preventDefault(); cuoi.focus(); }
      else if (!e.shiftKey && document.activeElement === cuoi) { e.preventDefault(); dau.focus(); }
    };
    document.addEventListener('keydown', onKey);

    // Đưa tiêu điểm vào trong hộp thoại ngay khi mở.
    const dauTien = hopRef.current?.querySelector<HTMLElement>(O_NHAN_TIEU_DIEM);
    (dauTien ?? hopRef.current)?.focus();

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
      noiXuatPhat?.focus?.();
    };
  }, [open]);

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
      <div
        ref={hopRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tieuDe}
        tabIndex={-1}
        className={`relative bg-white rounded-3xl shadow-pop w-full ${sizeMap[size]} max-h-[90vh] flex flex-col anim-pop outline-none print:static print:max-h-none print:max-w-none print:shadow-none print:rounded-none print:block`}
      >
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <h2 id={tieuDe} className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-lg text-cafe-400 hover:text-bean hover:bg-sand transition-colors" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 print:overflow-visible print:p-0">{children}</div>
        {footer && (
          // no-print: các nút bên trong đã tự ẩn khi in, nhưng KHUNG chứa chúng thì
          // không — nó vẫn giữ nguyên đường kẻ trên và 2rem đệm dọc, đủ để đẩy bản in
          // dài hơn tờ giấy đúng một chút và đẻ ra một trang thứ hai gần như trắng.
          <div className="no-print shrink-0 border-t border-line px-6 py-4 bg-white rounded-b-3xl">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
