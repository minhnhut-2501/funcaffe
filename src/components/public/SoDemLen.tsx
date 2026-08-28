'use client';

import { useDemSo } from '@/hooks/use-dem-so';

/**
 * Con số chạy tới giá trị mới thay vì nhảy phụp.
 *
 * `aria-live` để mặc định (off): trình đọc màn hình KHÔNG được đọc từng bước đếm —
 * đó là hàng chục lượt thông báo cho một con số. Người dùng đọc nó khi đi tới phần tử,
 * lúc đó lượt đếm đã xong và giá trị đã đúng.
 *
 * `tabular-nums` để bề rộng chữ số không đổi theo từng khung hình — thiếu nó thì cả
 * khối bên cạnh rung qua rung lại suốt lượt đếm.
 */
export default function SoDemLen({
  gia,
  dinhDang,
  className = '',
}: {
  gia: number;
  /** Đổi số thành chuỗi hiển thị (formatCurrency, toLocaleString…). */
  dinhDang: (v: number) => string;
  className?: string;
}) {
  const v = useDemSo(gia);
  return <span className={`tabular-nums ${className}`}>{dinhDang(v)}</span>;
}
