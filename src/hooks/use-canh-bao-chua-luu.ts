'use client';
import { useEffect } from 'react';

const THONG_DIEP_MAC_DINH = 'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất các thay đổi đó.';

/**
 * Nhắc trước khi rời trang khi form còn thay đổi chưa lưu.
 *
 * Chặn hai lối ra, vì chúng là hai cơ chế hoàn toàn khác nhau:
 *
 *  1. **Đóng tab / tải lại / đổi địa chỉ** — dùng `beforeunload`. Trình duyệt tự hiện
 *     hộp thoại của nó (không đổi được câu chữ, đó là quy định của trình duyệt để
 *     trang web không lừa người dùng ở lại).
 *  2. **Bấm một liên kết trong ứng dụng** — `beforeunload` KHÔNG bắn, vì Next chuyển
 *     trang bằng router chứ không nạp lại tài liệu. Phải tự bắt lượt bấm ở tầng
 *     `document` (pha capture, tức trước khi Next kịp xử lý) rồi hỏi lại.
 *
 * App Router chưa có API chặn điều hướng chính thức, nên cách bắt lượt bấm ở trên là
 * đường khả dụng duy nhất mà không phải chép lại toàn bộ thanh điều hướng. Nó bỏ sót
 * nút Back của trình duyệt — chấp nhận: mất một ô họ tên chưa lưu, không phải mất tiền.
 */
export function useCanhBaoChuaLuu(coThayDoi: boolean, thongDiep: string = THONG_DIEP_MAC_DINH): void {
  useEffect(() => {
    if (!coThayDoi) return;

    const truocKhiRoi = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Vài trình duyệt cũ vẫn cần returnValue mới hiện hộp thoại.
      e.returnValue = thongDiep;
      return thongDiep;
    };

    const khiBamLienKet = (e: MouseEvent) => {
      // Bấm kèm Ctrl/Cmd/Shift là mở tab mới — trang này vẫn còn đó, không cần hỏi.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

      const dich = new URL(a.href, window.location.href);
      if (dich.origin !== window.location.origin) return;
      // Cùng đường dẫn (ví dụ liên kết neo trong trang) thì không phải rời trang.
      if (dich.pathname === window.location.pathname) return;

      if (!window.confirm(thongDiep)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', truocKhiRoi);
    document.addEventListener('click', khiBamLienKet, true);
    return () => {
      window.removeEventListener('beforeunload', truocKhiRoi);
      document.removeEventListener('click', khiBamLienKet, true);
    };
  }, [coThayDoi, thongDiep]);
}
