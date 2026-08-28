/**
 * Deterministic formatters — produce identical output on server (Node.js) and
 * client (browser) so Next.js hydration never mismatches.
 */

export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return formatted + '\u00a0₫';
}

/**
 * Tiền rút gọn cho nhãn trục biểu đồ: 400k · 1,5tr · 12tr · 1,2 tỷ.
 *
 * Trước đây trục Y dùng cứng `(v / 1000000).toFixed(0) + 'tr'`, nên quán bán
 * 400k/ngày thì MỌI nhãn đều là "0tr" — biểu đồ vô dụng với đúng nhóm khách hàng
 * chính của FunCafe. Ở đây đơn vị co giãn theo độ lớn.
 *
 * Tự dựng chuỗi thay vì dùng Intl.NumberFormat: xem chú thích đầu file — các
 * formatter phải cho ra kết quả giống hệt nhau giữa server và client.
 */
export function formatCompactCurrency(amount: number): string {
  const n = Math.round(amount);
  const abs = Math.abs(n);
  if (abs < 1_000) return String(n);

  // Giữ 1 chữ số thập phân tới mốc 100 đơn vị. Ngưỡng phải rộng vì đây là nhãn của
  // ĐƯỜNG LƯỚI: recharts hay chia trục thành 0 / 4,5 / 9 / 13,5 / 18 triệu, làm tròn
  // sớm thì vạch 13,5tr bị ghi thành "14tr" — nhãn nói sai vị trí của chính nó.
  // Số nguyên vẫn ra gọn: .toFixed(1) của 12 là "12.0", đuôi ",0" bị cắt bên dưới.
  const scaled = (value: number, unit: string) => {
    const v = n / value;
    const text = Math.abs(v) < 100
      ? v.toFixed(1).replace(/\.0$/, '').replace('.', ',')
      : String(Math.round(v));
    return text + unit;
  };

  if (abs < 1_000_000) return scaled(1_000, 'k');
  if (abs < 1_000_000_000) return scaled(1_000_000, 'tr');
  return scaled(1_000_000_000, ' tỷ');
}

/** Nhóm hàng nghìn bằng dấu chấm (không kèm ký hiệu tiền) — dùng cho ô nhập giá. */
export function formatThousands(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return '';
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Lấy số nguyên từ chuỗi người dùng gõ (bỏ mọi ký tự không phải chữ số). */
export function parseThousands(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function parseDateStr(dateStr: string): { d: number; m: number; y: number; h: number; min: number } {
  const iso = dateStr.replace(' ', 'T');
  const dt = new Date(iso);
  if (dateStr.length <= 10) {
    return { d: dt.getUTCDate(), m: dt.getUTCMonth() + 1, y: dt.getUTCFullYear(), h: 0, min: 0 };
  }
  return { d: dt.getDate(), m: dt.getMonth() + 1, y: dt.getFullYear(), h: dt.getHours(), min: dt.getMinutes() };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDate(dateStr: string): string {
  const { d, m, y } = parseDateStr(dateStr);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export function formatDateTime(dateStr: string): string {
  const { d, m, y, h, min } = parseDateStr(dateStr);
  return `${pad(h)}:${pad(min)} ${pad(d)}/${pad(m)}/${y}`;
}

/**
 * NGÀY của một mốc thời gian, theo giờ ĐỊA PHƯƠNG, dạng 'YYYY-MM-DD'.
 *
 * Máy chủ trả về chuỗi ISO theo giờ UTC: một hóa đơn thu lúc 00:23 ngày 05/08 giờ
 * Việt Nam đi trên dây là `2026-08-04T17:23:55Z`. Cắt 10 ký tự đầu — cách các trang
 * làm trước đây — cho ra "2026-08-04", tức là ĐẨY doanh thu của bảy tiếng đầu mỗi
 * ngày sang ngày hôm trước.
 *
 * Hậu quả không nhỏ: quán bán tới khuya thì mỗi đêm một khoản tiền rơi nhầm ngày,
 * "doanh thu hôm nay" trên màn hình lệch với số máy chủ tự tính (máy chủ dùng giờ
 * Việt Nam), và lọc "từ ngày → đến ngày" bỏ sót đúng những hóa đơn ở rìa khoảng.
 *
 * Chuỗi chỉ có ngày ('2026-08-05') thì giữ nguyên — không có giờ để mà quy đổi.
 */
export function ngayDiaPhuong(dateStr: string): string {
  if (!dateStr) return '';
  const { d, m, y } = parseDateStr(dateStr);
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Hôm nay theo giờ địa phương, cùng dạng với `ngayDiaPhuong`. */
export function homNay(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/**
 * KHÓA GOM NHÓM theo giờ địa phương: 4 ký tự = năm, 7 = tháng, 10 = ngày.
 *
 * Tồn tại để không ai còn viết `dateStr.slice(0, doDai)` nữa. Cắt thẳng chuỗi ISO
 * là cắt trên giờ UTC — cùng một lỗi với `ngayDiaPhuong` nhưng khó thấy hơn nhiều,
 * vì khi lọc dùng giờ Việt Nam mà gom nhóm dùng giờ UTC thì một giao dịch **lọt vào
 * khoảng nhưng bị vẽ sang cột hôm trước**. Hai con số cùng trên một màn hình, cãi
 * nhau, không chỗ nào báo lỗi.
 *
 * Dùng chung một hàm cho cả lọc lẫn gom nhóm là cách duy nhất chắc chắn hai bên
 * không lệch (xem `keyLength()` trong `lib/chart.ts` để biết độ dài theo mốc).
 */
export function khoaThoiGian(dateStr: string, doDai: number): string {
  return ngayDiaPhuong(dateStr).slice(0, doDai);
}

/** Tháng của một mốc thời gian theo giờ địa phương, dạng 'YYYY-MM'. */
export function thangDiaPhuong(dateStr: string): string {
  return khoaThoiGian(dateStr, 7);
}

/** Tháng này theo giờ địa phương, cùng dạng với `thangDiaPhuong`. */
export function thangNay(): string {
  return homNay().slice(0, 7);
}

export function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cash: 'Tiền mặt',
    vietqr: 'Chuyển khoản',
    vnpay: 'VNPay',
    momo: 'MoMo',
    cancel: 'Hủy gói',
    bank_transfer: 'Chuyển khoản',
    transfer: 'Chuyển khoản',
    qr_code: 'QR Code',
    e_wallet: 'Ví điện tử',
  };
  return map[method] ?? method;
}

/** Nhãn hình thức bán. `takeaway` là đơn KHÔNG có bàn; mọi giá trị khác coi là tại quán. */
export function formatOrderType(orderType?: string): string {
  return orderType === 'takeaway' ? 'Mang về' : 'Tại quán';
}

export function formatTableStatus(status: string): string {
  const map: Record<string, string> = {
    empty: 'Trống',
    serving: 'Đang phục vụ',
  };
  return map[status] ?? status;
}

export function formatPackageName(type: string): string {
  const map: Record<string, string> = {
    none: 'Chưa có gói',
    free: 'Fun Free',
    pro: 'Pro',
    promax: 'Pro Max',
  };
  return map[type] ?? type;
}

/**
 * Thời hạn gói: "12 tháng", "7 ngày".
 *
 * Đơn vị BẮT BUỘC đi kèm giá trị. Gói dùng thử tính bằng ngày (7 ngày) còn gói trả
 * phí tính bằng tháng — mặc định "tháng" cho mọi giá trị sẽ biến gói 7 ngày thành
 * "7 tháng". Xem `time_subscriptions.duration_unit`.
 *
 * Thiếu dữ liệu (giao dịch cũ không gắn mốc thời hạn) trả dấu gạch, không đoán bừa.
 */
export function formatDuration(value?: number, unit: 'day' | 'month' = 'month'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value} ${unit === 'day' ? 'ngày' : 'tháng'}`;
}
