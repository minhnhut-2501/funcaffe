'use client';

import { useLayoutEffect, useEffect, useRef, useState } from 'react';

/**
 * Scroll-reveal wrapper cho trang Public.
 *
 * QUAN TRỌNG: mặc định là HIỆN. Chỉ khi JS chạy được và phần tử đang nằm dưới
 * màn hình thì mới ẩn đi để chạy hiệu ứng (ẩn trong useLayoutEffect nên không
 * bị nháy). Trước đây mặc định là ẩn (opacity 0) — nghĩa là bot thu thập dữ liệu,
 * tab ẩn hoặc lúc JS lỗi sẽ thấy section TRẮNG TRƠN.
 *
 * Dùng IntersectionObserver (không dùng scroll listener) và tôn trọng
 * prefers-reduced-motion.
 */

/**
 * Trần độ trễ so le.
 *
 * Chỗ gọi tự tính `delay={i * 70}` hoặc `i * 90` theo chỉ số trong danh sách, nên một
 * danh sách 6 mục cho ra 350ms — cộng với 500ms chạy hiệu ứng là mục cuối tới sau khi
 * lọt vào màn hình gần MỘT GIÂY. Người đọc đã nhìn thẳng vào chỗ đó và đang chờ chữ
 * hiện ra: cảm giác không phải "mượt" mà là "trang lag".
 *
 * Chặn trần ở đây thay vì đi sửa từng chỗ gọi: so le vẫn còn (mắt vẫn thấy thứ tự),
 * chỉ là từ mục thứ tư trở đi thì vào cùng lúc — không ai đếm được, mà cũng không ai
 * phải chờ.
 */
const TRE_TOI_DA = 240;

export default function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
  id,
}: {
  children: React.ReactNode;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(true);
  const [armed, setArmed] = useState(false);

  // Chạy TRƯỚC khi vẽ: chỉ ẩn phần tử còn nằm dưới màn hình.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setShown(false);
    setArmed(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !armed) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed]);

  const Comp = Tag as React.ElementType;
  return (
    <Comp
      ref={ref}
      id={id}
      className={`reveal ${shown ? 'is-in' : ''} ${className}`}
      style={{ ['--reveal-delay' as string]: `${Math.min(delay, TRE_TOI_DA)}ms` }}
    >
      {children}
    </Comp>
  );
}
