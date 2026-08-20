'use client';

import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import { goTien } from '@/lib/nhap-tien';

/**
 * NỀN CHUNG cho mọi ô nhập số của dự án — và là chỗ duy nhất biết cách sống chung với
 * BỘ GÕ TIẾNG VIỆT. `MoneyInput` là ô này khoác thêm dấu chấm hàng nghìn.
 *
 * Gốc của mọi rắc rối: sửa nội dung ô TRONG LÚC người ta đang gõ. Bàn phím tiếng Anh
 * chịu được; bộ gõ tiếng Việt thì không — nó đang giữ một lượt "đang soạn", bị kéo
 * chuỗi ra dưới chân thì tới lúc chốt nó chèn lại ký tự vừa gõ một lần nữa. Mỗi phím
 * thành hai chữ số: gõ 2-0-0-0-0-0 mong ra 200.000 mà nhận về 200.000.000.
 *
 * Và "sửa nội dung ô" KHÔNG chỉ là chấm hàng nghìn. Một ô `value={form.capacity ?? 4}`
 * bình thường cũng sửa: xóa trắng ô thì `Number('')` ra 0, React ghi ngược "0" vào ô,
 * gõ tiếp số 8 thành "08". Đó là lý do ô sức chứa bàn hỏng y như ô tiền.
 *
 * Hai chế độ, tự nhận ra chứ không hỏi ai:
 *
 *   - CHƯA THẤY BỘ GÕ: chuẩn hóa ngay từng phím, con trỏ bám theo chữ số vừa gõ
 *     (`lib/nhap-tien.ts`). Đây là đường của bàn phím thường.
 *   - ĐÃ THẤY BỘ GÕ (`compositionstart` bắn ra ở bất kỳ ô số nào): trong lúc ô còn
 *     con trỏ thì KHÔNG AI được ghi vào ô nữa. Số vẫn báo lên trên đều đặn nên phần
 *     còn lại của màn hình vẫn đúng theo từng phím; rời ô mới chuẩn hóa một lượt.
 *
 * Nhận ra ngay từ phím ĐẦU TIÊN: `compositionstart` bắn trước lượt `input` đầu tiên
 * của chính phím đó. Nhớ chung cho cả trang (sessionStorage) nên các ô khác khỏi học lại.
 *
 * Hai điều đã trả giá, đừng làm lại:
 *   - `compositionend` CÓ THỂ KHÔNG BAO GIỜ BẮN. Treo cờ chờ nó hạ là ô chết cứng.
 *   - Ghi vào ô ở `compositionstart` là xóa mất vùng đang bôi đen, nên "bôi đen cả ô
 *     rồi gõ đè" biến thành chèn thêm vào số cũ. Dọn dấu phân cách lúc VÀO Ô mới đúng.
 *
 * Kịch bản kiểm: `scripts/kiem-o-nhap-tien.mjs` (mô phỏng bộ gõ bằng CDP).
 */

const KHOA_BO_GO = 'funcafe_da_thay_bo_go';
let daThayBoGo = false;

function ghiNhanBoGo() {
  daThayBoGo = true;
  try { sessionStorage.setItem(KHOA_BO_GO, '1'); } catch { /* chế độ riêng tư: nhớ trong phiên là đủ */ }
}

export type ONhapSoProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** null = CHƯA NHẬP GÌ (ô rỗng), khác hẳn số 0. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Cách viết số ra màn hình khi ô nghỉ (mặc định: viết trần). */
  dinhDang?: (so: number) => string;
  /** Kẹp lại khi RỜI Ô, không kẹp trong lúc gõ: gõ "12" bao giờ cũng đi qua "1". */
  min?: number;
  max?: number;
};

export function ONhapSo({ value, onChange, dinhDang = String, min, max, onFocus, onBlur, ...props }: ONhapSoProps) {
  const oRef = useRef<HTMLInputElement>(null);
  const dangGo = useRef(false);
  const hien = value == null ? '' : dinhDang(value);

  useEffect(() => {
    if (!daThayBoGo && sessionStorage.getItem(KHOA_BO_GO) === '1') daThayBoGo = true;
  }, []);

  // Đồng bộ MỘT CHIỀU từ ngoài vào: nút bấm đặt sẵn số, xóa trắng sau khi xong việc,
  // biểu mẫu nạp dữ liệu cũ lên. Đang gõ bằng bộ gõ thì nhịn — chính cú ghi này làm hỏng.
  useEffect(() => {
    const el = oRef.current;
    if (!el || (daThayBoGo && dangGo.current)) return;
    if (el.value !== hien) el.value = hien;
  }, [hien]);

  /**
   * NGHE THẲNG sự kiện `input` của trình duyệt, không qua `onChange` của React.
   *
   * React lọc trùng sự kiện theo giá trị ô: với bộ gõ, mỗi phím bắn HAI lượt `input`
   * mang cùng một nội dung — lượt "đang soạn" và lượt chốt. Ta bỏ qua lượt đầu (bộ gõ
   * đang làm việc), thì React coi lượt chốt là trùng và NUỐT LUÔN. Hậu quả: gõ tiền
   * mà tiền thối trên màn hình đứng im, tới lúc rời ô mới nhảy một cái.
   *
   * Đăng ký lại mỗi lượt vẽ (không truyền mảng phụ thuộc) để `onChange` luôn là bản
   * mới nhất — gỡ ngay ở nhánh dọn dẹp nên không chồng nhiều lượt nghe.
   */
  useEffect(() => {
    const el = oRef.current;
    if (!el) return;
    const nghe = (e: Event) => {
      // Đang soạn, hoặc máy này đã lộ ra là có bộ gõ: CHỈ báo số lên trên, không đụng
      // vào nội dung ô. Báo cả trong lúc soạn là cố ý — đo trên trình duyệt thật cho
      // thấy có luồng bộ gõ mà `compositionend` không bao giờ bắn, mọi lượt `input`
      // đều mang cờ "đang soạn"; im lặng chờ nó chốt thì tiền thối đứng im tới lúc
      // rời ô. Báo số thì vô hại — cái làm hỏng là GHI VÀO Ô, mà đây không ghi.
      if (daThayBoGo || (e as InputEvent).isComposing) chiBaoSo(el);
      else chuanHoa(el);
    };
    el.addEventListener('input', nghe);
    return () => el.removeEventListener('input', nghe);
  });

  const kep = (so: number | null) => {
    if (so == null) return null;
    if (min != null && so < min) return min;
    if (max != null && so > max) return max;
    return so;
  };

  /** Viết lại ô cho gọn và đặt con trỏ về đúng chữ số vừa gõ, rồi báo số lên trên. */
  const chuanHoa = (el: HTMLInputElement, keptLai = false) => {
    const ra = goTien(el.value, el.selectionStart ?? el.value.length);
    const so = keptLai ? kep(ra.so) : ra.so;
    const chu = so == null ? '' : dinhDang(so);
    el.value = chu;
    // Kẹp lại làm đổi cả con số thì con trỏ về cuối; còn lại giữ đúng chữ số đang gõ.
    const dat = chu === ra.hien ? ra.caret : chu.length;
    el.setSelectionRange(dat, dat);
    onChange(so);
  };

  /** Chỉ báo số lên trên, KHÔNG đụng vào nội dung ô. Dùng khi bộ gõ đang làm việc. */
  const chiBaoSo = (el: HTMLInputElement) => {
    const chuSo = el.value.replace(/\D/g, '');
    onChange(chuSo === '' ? null : Number(chuSo));
  };

  return (
    <input
      ref={oRef}
      type="text"
      inputMode="numeric"
      defaultValue={hien}
      // Chỉ ghi nhận "máy này có bộ gõ", tuyệt đối không đụng vào nội dung ô ở đây.
      onCompositionStart={ghiNhanBoGo}
      // Việc gõ do lượt nghe `input` ở trên lo; `onChange` chỉ ở đây cho React yên
      // tâm rằng ô này có người trông.
      onChange={() => {}}
      onFocus={e => {
        dangGo.current = true;
        // Máy có bộ gõ: bỏ dấu phân cách ngay khi vào ô, để từ giờ tới lúc rời ô không
        // còn cú ghi nào rơi vào giữa lúc đang gõ. Lúc này chưa ai gõ gì nên ghi vô hại.
        const el = e.currentTarget;
        if (daThayBoGo && /\D/.test(el.value)) {
          const chuSo = el.value.replace(/\D/g, '');
          el.value = chuSo;
          el.setSelectionRange(chuSo.length, chuSo.length);
        }
        onFocus?.(e);
      }}
      onBlur={e => {
        dangGo.current = false;
        // Rời ô mới kẹp vào khoảng cho phép và viết lại cho gọn: lúc này không còn bộ
        // gõ nào đang soạn dở, mà số dở dang trên đường gõ cũng đã gõ xong.
        chuanHoa(e.currentTarget, true);
        onBlur?.(e);
      }}
      {...props}
    />
  );
}

/** Ô nhập số nguyên (sức chứa, số bàn, số tháng...) — viết trần, không dấu phân cách. */
export default function NumberInput(props: Omit<ONhapSoProps, 'dinhDang'>) {
  return <ONhapSo {...props} />;
}
