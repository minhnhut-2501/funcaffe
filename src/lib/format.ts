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

export function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cash: 'Tiền mặt',
    vietqr: 'Chuyển khoản',
    vnpay: 'VNPay',
    cancel: 'Hủy gói',
    bank_transfer: 'Chuyển khoản',
    transfer: 'Chuyển khoản',
    qr_code: 'QR Code',
    e_wallet: 'Ví điện tử',
  };
  return map[method] ?? method;
}

export function formatOrderStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Đang phục vụ',
    paid: 'Đã thanh toán',
    cancelled: 'Đã hủy',
  };
  return map[status] ?? status;
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

export function formatDuration(months: number): string {
  if (months === 1) return '1 tháng';
  if (months === 3) return '3 tháng';
  if (months === 12) return '12 tháng';
  return `${months} tháng`;
}
