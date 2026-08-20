import { formatThousands } from './format';

/**
 * Tính lại ô nhập tiền sau MỘT lần gõ — số, chuỗi hiện ra, và CHỖ ĐẶT CON TRỎ.
 *
 * Chỗ đặt con trỏ mới là phần dễ sai và cũng là phần từng sai: cách làm cũ để trình
 * duyệt tự giữ con trỏ theo SỐ KÝ TỰ. Nhưng mỗi lần vượt mốc nghìn, chuỗi hiện ra mọc
 * thêm một dấu chấm, đẩy mọi ký tự sau nó trôi đi một chỗ — con trỏ giữ nguyên chỉ số
 * cũ nên rơi sang vị trí khác, và ký tự gõ tiếp theo chèn vào giữa con số. Thu ngân
 * gõ thêm một số 0 vào "20.000" mà ra "2.000.000" là bắt nguồn từ đây.
 *
 * Cách chữa: nhớ con trỏ bằng SỐ CHỮ SỐ ĐỨNG TRƯỚC NÓ — thứ dấu chấm không đụng tới —
 * rồi tìm lại đúng chỗ đó trong chuỗi mới.
 *
 * @param tho   nội dung ô ngay sau khi trình duyệt chèn/xóa (còn nguyên dấu chấm)
 * @param caret vị trí con trỏ trong chuỗi đó
 */
export function goTien(tho: string, caret: number): { so: number | null; hien: string; caret: number } {
  const chuSo = tho.replace(/\D/g, '');
  const so = chuSo === '' ? null : Number(chuSo);
  const hien = so == null ? '' : formatThousands(so);

  // Số 0 thừa ở đầu bị Number() nuốt mất ("020000" → 20000). Không trừ đi phần đã mất
  // thì con trỏ dôi ra một chỗ cho mỗi số 0 đó.
  const nuot = chuSo.length - (so == null ? 0 : String(so).length);
  const truoc = Math.max(0, tho.slice(0, Math.max(0, caret)).replace(/\D/g, '').length - nuot);

  return { so, hien, caret: viTriSauChuSo(hien, truoc) };
}

/** Vị trí ký tự nằm ngay sau chữ số thứ `n` của chuỗi đã chấm hàng nghìn. */
function viTriSauChuSo(chuoi: string, n: number): number {
  if (n <= 0) return 0;
  let dem = 0;
  for (let i = 0; i < chuoi.length; i++) {
    if (chuoi[i] >= '0' && chuoi[i] <= '9' && ++dem === n) return i + 1;
  }
  return chuoi.length;
}
