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
    reserved: 'Đã đặt',
    cleaning: 'Cần dọn',
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
