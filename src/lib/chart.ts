/**
 * Điền các mốc thời gian KHÔNG có dữ liệu vào chuỗi biểu đồ.
 *
 * Gom nhóm bằng object thường chỉ sinh ra key của những ngày thực sự có giao dịch,
 * nên ngày không bán được gì sẽ biến mất khỏi trục hoành thay vì hiện cột 0. Hệ quả
 * là hai ngày cách nhau hai tuần đứng sát nhau, biểu đồ trông như doanh thu đều đặn
 * trong khi thực tế có quãng đứt. "Bán được 0 đồng" là thông tin cần thấy.
 */

export type ChartMode = 'day' | 'month' | 'year';

/** Độ dài chuỗi 'YYYY-MM-DD' cần cắt để ra key của từng chế độ. */
export const keyLength = (mode: ChartMode) => (mode === 'day' ? 10 : mode === 'year' ? 4 : 7);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Mốc kế tiếp của một key. Tự cộng theo giờ ĐỊA PHƯƠNG: dựng Date bằng
 * `new Date(y, m, d)` rồi đọc lại getFullYear/getMonth/getDate, không đi qua
 * toISOString() — chuỗi ISO là giờ UTC nên ở múi giờ +7 sẽ lùi mất một ngày.
 */
function nextKey(key: string, mode: ChartMode): string {
  if (mode === 'year') return String(Number(key) + 1);
  if (mode === 'month') {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + 1, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  const [y, m, day] = key.split('-').map(Number);
  const d = new Date(y, m - 1, day + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Số mốc tối đa được phép sinh — chặn trường hợp lọc nhầm ra khoảng vài chục năm. */
const MAX_BUCKETS = 1000;

/**
 * @param buckets  key ('YYYY-MM-DD' / 'YYYY-MM' / 'YYYY') -> giá trị đã gom.
 * @param from,to  khoảng 'YYYY-MM-DD' người dùng đang lọc. Bỏ trống thì lấy
 *                 min→max của chính dữ liệu.
 * @returns        dãy key liên tục, mốc trống mang giá trị 0.
 */
export function fillGaps<T>(
  buckets: Record<string, T>,
  mode: ChartMode,
  empty: T,
  from?: string,
  to?: string,
): { key: string; value: T }[] {
  const present = Object.keys(buckets).sort();
  const len = keyLength(mode);
  // Khoảng lọc cũng phải cắt về đúng độ dài key, nếu không 'YYYY-MM-DD' đem so
  // với key 'YYYY-MM' sẽ luôn lớn hơn và mốc đầu bị bỏ mất.
  const start = (from ? from.slice(0, len) : present[0]) ?? '';
  const end = (to ? to.slice(0, len) : present[present.length - 1]) ?? '';
  if (!start || !end || start > end) {
    return present.map(key => ({ key, value: buckets[key] }));
  }

  const out: { key: string; value: T }[] = [];
  let cur = start;
  while (cur <= end && out.length < MAX_BUCKETS) {
    out.push({ key: cur, value: buckets[cur] ?? empty });
    cur = nextKey(cur, mode);
  }
  return out;
}

/**
 * Nhãn hiển thị trên trục hoành, đồng bộ giữa các trang doanh thu.
 * Chế độ ngày ra 'DD/MM' chứ không phải 'MM-DD' như trước: cắt thẳng chuỗi ISO
 * cho ra "04-30", người Việt đọc thành ngày 4 tháng 30.
 */
export const axisLabel = (key: string, mode: ChartMode) => {
  if (mode === 'year') return key;
  if (mode === 'month') return `T${key.slice(5)}`;
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
};

/**
 * Nhãn đầy đủ cho tooltip. Nhãn trục phải ngắn để không chồng nhau, nhưng "30/04"
 * thì nhập nhằng khi khoảng lọc bắc qua hai năm — tooltip có chỗ nên nói rõ ra.
 */
export const fullLabel = (key: string, mode: ChartMode) => {
  if (mode === 'year') return `Năm ${key}`;
  const [y, m, d] = key.split('-');
  if (mode === 'month') return `Tháng ${Number(m)}/${y}`;
  return `${d}/${m}/${y}`;
};

/**
 * Nhãn dày quá thì Recharts vẽ chồng lên nhau. Trên ~20 cột thì để nó tự thưa
 * bớt nhưng luôn giữ mốc đầu và mốc cuối.
 */
export const axisInterval = (count: number) =>
  count > 20 ? ('preserveStartEnd' as const) : 0;

/** Số ngày giữa hai mốc 'YYYY-MM-DD' (tính cả hai đầu). */
function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

/** Số mốc mà một chế độ sẽ sinh ra trên khoảng đang lọc. */
export function bucketCount(mode: ChartMode, from: string, to: string): number {
  if (!from || !to) return 0;
  const days = daysBetween(from, to);
  if (days <= 0) return 0;
  if (mode === 'day') return days;
  if (mode === 'month') {
    const [y1, m1] = from.split('-').map(Number);
    const [y2, m2] = to.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1) + 1;
  }
  return Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1;
}

/**
 * Mốc mặc định hợp với độ dài khoảng đang lọc. Người dùng vẫn chỉnh tay được,
 * nhưng khi chưa chỉnh thì đổi khoảng ngày là mốc tự đi theo — chọn "12 tháng qua"
 * mà biểu đồ vẫn vẽ 365 cột theo ngày thì chẳng đọc được gì.
 */
export function suggestMode(from: string, to: string): ChartMode {
  if (!from || !to) return 'day';
  const days = daysBetween(from, to);
  if (days <= 62) return 'day';
  if (days <= 730) return 'month';
  return 'year';
}

/** Dưới mức này thì biểu đồ chỉ còn một hai cột, không so sánh được gì. */
const MIN_BUCKETS = 2;
/** Trên mức này thì cột mảnh như sợi tóc, nhãn trục cũng không còn đọc được. */
const MAX_USEFUL_BUCKETS = 400;

/**
 * Mốc này có dùng được với khoảng đang lọc không, và nếu không thì vì sao.
 * Trả về `reason` để nút trong bộ chọn nói thẳng lý do bị làm mờ thay vì im lặng.
 */
export function modeStatus(
  mode: ChartMode,
  from: string,
  to: string,
): { buckets: number; usable: boolean; reason?: string } {
  // Chưa chọn khoảng nào (xem toàn bộ thời gian) thì không chặn gì cả.
  if (!from || !to) return { buckets: 0, usable: true };
  const buckets = bucketCount(mode, from, to);
  const unit = mode === 'day' ? 'ngày' : mode === 'month' ? 'tháng' : 'năm';
  if (buckets < MIN_BUCKETS) {
    return { buckets, usable: false, reason: `Khoảng đang lọc chỉ nằm trong ${buckets} ${unit} — xem theo ${unit} sẽ ra đúng ${buckets} cột.` };
  }
  if (buckets > MAX_USEFUL_BUCKETS) {
    return { buckets, usable: false, reason: `Khoảng đang lọc dài ${buckets} ${unit} — vẽ hết sẽ không đọc được. Chọn mốc lớn hơn.` };
  }
  return { buckets, usable: true };
}
