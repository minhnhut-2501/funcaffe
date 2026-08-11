/** Quán đang chọn (đa quán). Mọi endpoint cafes/{cafeId}/... đi qua đây. */
import { api } from '@/lib/api-client';

// ĐA QUÁN: "quán đang chọn" (active café). Mọi endpoint cafes/{cafeId}/... dùng id này.
// Nhớ theo localStorage để giữ lựa chọn giữa các lần tải trang; xóa khi đăng xuất.
let cafeIdCache: string | null = null;
const ACTIVE_CAFE_KEY = 'funcafe.activeCafeId';

function readStoredCafeId(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(ACTIVE_CAFE_KEY); } catch { return null; }
}

// Đặt quán đang chọn (được gọi từ AuthContext khi đăng nhập / chuyển quán / tạo quán).
export function setActiveCafeId(id: string | null) {
  cafeIdCache = id;
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_CAFE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_CAFE_KEY);
  } catch { /* ignore */ }
}

export function rawCafeId(c: any): string {
  return c?.id ?? c?._id;
}

// Chọn quán đang dùng từ danh sách id: ưu tiên quán đã chọn trước đó (cache/localStorage)
// nếu còn thuộc user, ngược lại lấy quán đầu. Trả về id đã chọn (và lưu lại).
export function pickActiveCafeId(cafeIds: string[]): string | null {
  if (cafeIds.length === 0) { setActiveCafeId(null); return null; }
  const current = cafeIdCache ?? readStoredCafeId();
  const chosen = current && cafeIds.includes(current) ? current : cafeIds[0];
  setActiveCafeId(chosen);
  return chosen;
}

async function getCafeId(): Promise<string> {
  if (cafeIdCache) return cafeIdCache;
  const cafes = await api.get<any[]>('/cafes');
  const ids = cafes.map(rawCafeId).filter(Boolean);
  if (ids.length === 0) throw new Error('NO_CAFE');
  const stored = readStoredCafeId();
  const chosen = stored && ids.includes(stored) ? stored : ids[0];
  setActiveCafeId(chosen);
  return chosen;
}

function getCafeIdSync(): string | null {
  return cafeIdCache;
}

/**
 * Quán đang chọn theo phỏng đoán tốt nhất, KHÔNG gọi mạng: cache trong bộ nhớ,
 * hoặc lựa chọn đã lưu từ lần trước.
 *
 * Dùng để bắn trước request phụ thuộc quán song song với `GET /cafes` thay vì phải
 * chờ nó trả về. Giá trị này CHƯA được kiểm chứng — nơi gọi phải đối chiếu lại với
 * danh sách quán thật rồi bỏ kết quả nếu đoán sai.
 */
export function peekActiveCafeId(): string | null {
  return cafeIdCache ?? readStoredCafeId();
}

export function clearCafeCache() { setActiveCafeId(null); }

export { getCafeId, getCafeIdSync };
