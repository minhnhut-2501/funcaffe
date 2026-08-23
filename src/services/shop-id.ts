/** Quán đang chọn (đa quán). Mọi endpoint shops/{shopId}/... đi qua đây. */
import { api } from '@/lib/api-client';

// ĐA QUÁN: "quán đang chọn" (active café). Mọi endpoint shops/{shopId}/... dùng id này.
// Nhớ theo localStorage để giữ lựa chọn giữa các lần tải trang; xóa khi đăng xuất.
let shopIdCache: string | null = null;
const ACTIVE_SHOP_KEY = 'funcafe.activeShopId';

function readStoredShopId(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(ACTIVE_SHOP_KEY); } catch { return null; }
}

// Đặt quán đang chọn (được gọi từ AuthContext khi đăng nhập / chuyển quán / tạo quán).
export function setActiveShopId(id: string | null) {
  shopIdCache = id;
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_SHOP_KEY, id);
    else window.localStorage.removeItem(ACTIVE_SHOP_KEY);
  } catch { /* ignore */ }
}

export function rawShopId(c: any): string {
  return c?.id ?? c?._id;
}

// Chọn quán đang dùng từ danh sách id: ưu tiên quán đã chọn trước đó (cache/localStorage)
// nếu còn thuộc user, ngược lại lấy quán đầu. Trả về id đã chọn (và lưu lại).
export function pickActiveShopId(shopIds: string[]): string | null {
  if (shopIds.length === 0) { setActiveShopId(null); return null; }
  const current = shopIdCache ?? readStoredShopId();
  const chosen = current && shopIds.includes(current) ? current : shopIds[0];
  setActiveShopId(chosen);
  return chosen;
}

async function getShopId(): Promise<string> {
  if (shopIdCache) return shopIdCache;
  const shops = await api.get<any[]>('/shops');
  const ids = shops.map(rawShopId).filter(Boolean);
  if (ids.length === 0) throw new Error('NO_SHOP');
  const stored = readStoredShopId();
  const chosen = stored && ids.includes(stored) ? stored : ids[0];
  setActiveShopId(chosen);
  return chosen;
}

function getShopIdSync(): string | null {
  return shopIdCache;
}

/**
 * Quán đang chọn theo phỏng đoán tốt nhất, KHÔNG gọi mạng: cache trong bộ nhớ,
 * hoặc lựa chọn đã lưu từ lần trước.
 *
 * Dùng để bắn trước request phụ thuộc quán song song với `GET /shops` thay vì phải
 * chờ nó trả về. Giá trị này CHƯA được kiểm chứng — nơi gọi phải đối chiếu lại với
 * danh sách quán thật rồi bỏ kết quả nếu đoán sai.
 */
export function peekActiveShopId(): string | null {
  return shopIdCache ?? readStoredShopId();
}

export function clearShopCache() { setActiveShopId(null); }

export { getShopId, getShopIdSync };
