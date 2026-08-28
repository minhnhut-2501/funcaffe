'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Đếm một con số chạy từ giá trị đang hiện tới giá trị mới.
 *
 * Dùng cho những chỗ con số THẬT SỰ ĐỔI — tổng tiền trong phiếu order khi thêm món,
 * giá gói khi đổi thời hạn. Không dùng để "cho vui": một con số cố định đếm từ 0 lên
 * mỗi lần cuộn tới là hiệu ứng rỗng, và nó còn làm chậm việc đọc chính con số đó.
 *
 * VÌ SAO GIỮ GIÁ TRỊ HIỆN TẠI TRONG REF: nếu người dùng bấm đổi thời hạn lần thứ hai
 * lúc lượt đếm trước chưa xong, lượt mới phải bắt đầu từ chỗ con số ĐANG hiện. Bắt
 * đầu lại từ mốc cũ là số nhảy giật về sau rồi mới chạy tới.
 *
 * Giá trị khởi tạo bằng đúng đích, nên bản dựng ở máy chủ và trình duyệt không chạy
 * JS đều hiện ra con số đúng ngay từ đầu — không bao giờ thấy số 0.
 */
export function useDemSo(dich: number, thoiGian = 480): number {
  const [hien, setHien] = useState(dich);
  const hienRef = useRef(dich);
  const rafRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      hienRef.current = dich;
      setHien(dich);
      return;
    }
    const tu = hienRef.current;
    if (tu === dich) return;

    const batDau = performance.now();
    const chay = (t: number) => {
      const p = Math.min(1, (t - batDau) / thoiGian);
      // Cùng đường cong với --ease-out-expo: vọt tới đích rồi hãm lại.
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      const v = Math.round(tu + (dich - tu) * e);
      hienRef.current = v;
      setHien(v);
      if (p < 1) rafRef.current = requestAnimationFrame(chay);
    };
    rafRef.current = requestAnimationFrame(chay);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dich, thoiGian]);

  return hien;
}
