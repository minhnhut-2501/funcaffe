'use client';

import { formatThousands } from '@/lib/format';
import { ONhapSo, type ONhapSoProps } from './NumberInput';

/**
 * Ô nhập tiền: chấm hàng nghìn, còn mọi chuyện khác giao cho `ONhapSo` — kể cả chuyện
 * khó nhất là sống chung với bộ gõ tiếng Việt (đọc chú thích ở `NumberInput.tsx`).
 *
 * Quy ước giá trị: `null` là CHƯA NHẬP GÌ (ô rỗng), khác hẳn số 0. Màn hình Bán hàng
 * cần phân biệt hai chuyện đó để nói đúng câu: "chưa gõ gì" hay "đưa còn thiếu".
 */
export default function MoneyInput(props: Omit<ONhapSoProps, 'dinhDang'>) {
  return <ONhapSo {...props} dinhDang={formatThousands} />;
}
