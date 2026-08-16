'use client';

import { useEffect, useRef, useState } from 'react';
import { theoDoiApi } from '@/lib/api-progress';

/**
 * Vạch mảnh chạy dưới mép trên màn hình khi có lượt gọi API đang bay.
 *
 * Ứng dụng đã có khung xương lúc mở trang và chữ "Đang lưu..." trên nút, nhưng cả hai
 * phải gắn TỪNG CHỖ — nên vẫn còn những lượt chờ đứng im không báo gì: đổi quán ở ô
 * chọn quán, đổi bộ lọc ngày ở trang Doanh thu, tải lại nền sau khi lưu. Thanh này
 * không cần biết trước có bao nhiêu trường hợp: cứ có lượt gọi là nó chạy.
 *
 * BA QUYẾT ĐỊNH VỀ THỜI GIAN, đều để tránh nhấp nháy:
 *
 *  1. Chờ 180ms rồi mới hiện. Phần lớn lượt gọi khi đã đệm ở biên chỉ mất ~150ms —
 *     hiện rồi tắt ngay trong khoảng đó chỉ tạo ra một cú giật khó chịu, tệ hơn là
 *     không có gì.
 *  2. Bò tới 90% rồi dừng. Ta KHÔNG biết còn bao lâu (máy chủ ở Virginia, có lượt
 *     150ms có lượt 2 giây), nên vạch không được phép chạm 100% khi chưa xong —
 *     chạm rồi mà vẫn treo thì nó thành lời hứa suông.
 *  3. Xong thì phóng tới 100%, giữ 200ms rồi mờ đi. Biến mất tức khắc ở 90% khiến
 *     người ta tưởng vừa bị hủy giữa chừng.
 *
 * Tôn trọng `prefers-reduced-motion`: giữ nguyên vạch, chỉ bỏ phần bò dần.
 */
export default function ApiProgressBar() {
  const [phanTram, setPhanTram] = useState(0);
  const [hien, setHien] = useState(false);
  const hoTro = useRef<{ cho?: number; bo?: number; tat?: number }>({});

  useEffect(() => {
    const t = hoTro.current;
    const donDep = () => {
      window.clearTimeout(t.cho);
      window.clearInterval(t.bo);
      window.clearTimeout(t.tat);
    };

    return theoDoiApi((dangChay) => {
      donDep();

      if (dangChay > 0) {
        t.cho = window.setTimeout(() => {
          setHien(true);
          setPhanTram(12);
          // Bò chậm dần: nhích nhanh lúc đầu, gần 90% thì gần như đứng. Cảm giác
          // "đang tiến" mà không bao giờ hứa sắp xong.
          t.bo = window.setInterval(() => {
            setPhanTram((p) => (p >= 90 ? p : p + Math.max(0.4, (90 - p) / 14)));
          }, 180);
        }, 180);
        return;
      }

      // Lượt cuối cùng đã về. Chưa kịp hiện thì thôi luôn, đừng lóe lên một cái.
      setHien((dangHien) => {
        if (!dangHien) return false;
        setPhanTram(100);
        t.tat = window.setTimeout(() => {
          setHien(false);
          setPhanTram(0);
        }, 220);
        return true;
      });
    });
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[100] h-0.5 pointer-events-none"
      style={{ opacity: hien ? 1 : 0, transition: 'opacity 200ms ease-out' }}
    >
      <div
        className="h-full bg-bean"
        style={{
          width: `${phanTram}%`,
          transition: 'width 220ms ease-out',
          boxShadow: '0 0 8px var(--color-bean)',
        }}
      />
    </div>
  );
}
