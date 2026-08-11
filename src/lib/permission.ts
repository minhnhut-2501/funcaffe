import type { UserPackageType, UserSubscription } from '@/types';

export interface PackageLimits {
  maxTables: number;    // Infinity = không giới hạn
  maxMenuItems: number; // Infinity = không giới hạn
  canUseAI: boolean;
}

// Giá trị MẶC ĐỊNH theo loại gói — chỉ dùng làm FALLBACK khi document gói chưa có
// field cấu hình (dữ liệu cũ). Nguồn chân lý thực tế là field trên gói do admin chỉnh
// (packages.max_tables / max_menu_items / can_use_ai), được nạp
// vào user.subscription ở AuthContext và khớp backend EnforcesPackageLimits.
const PACKAGE_LIMITS: Record<UserPackageType, PackageLimits> = {
  none:   { maxTables: 0,        maxMenuItems: 0,        canUseAI: false },
  // Fun Free là bản dùng thử Pro Max 7 ngày nên có luôn AI (khớp packages.can_use_ai).
  free:   { maxTables: Infinity, maxMenuItems: Infinity, canUseAI: true  },
  pro:    { maxTables: 20,       maxMenuItems: 40,       canUseAI: false },
  promax: { maxTables: Infinity, maxMenuItems: Infinity, canUseAI: true  },
};

export function defaultPackageLimits(pkg: UserPackageType): PackageLimits {
  return PACKAGE_LIMITS[pkg] ?? PACKAGE_LIMITS.none;
}

// Giới hạn/quyền THỰC TẾ của người dùng: ưu tiên field đã cấu hình trên subscription,
// fallback theo loại gói khi thiếu.
export function packageLimits(sub: UserSubscription | null | undefined): PackageLimits {
  const fb = defaultPackageLimits(sub?.packageType ?? 'none');
  if (!sub) return fb;
  return {
    maxTables: sub.maxTables ?? fb.maxTables,
    maxMenuItems: sub.maxMenuItems ?? fb.maxMenuItems,
    canUseAI: sub.canUseAI ?? fb.canUseAI,
  };
}

// Gói đã hết hạn: vẫn còn document sub (status 'active') nhưng endDate đã qua.
// Tính theo thời điểm gọi để chính xác kể cả khi app mở qua mốc hết hạn.
export function isSubscriptionExpired(sub: UserSubscription | null | undefined): boolean {
  if (!sub || sub.packageType === 'none' || !sub.endDate) return false;
  return new Date(sub.endDate).getTime() <= Date.now();
}

/** Số ngày còn lại thì coi là "sắp hết hạn". */
export const EXPIRY_SOON_DAYS = 7;

export type ExpiryState = 'none' | 'ok' | 'soon' | 'expired';

/**
 * Trạng thái hạn gói của MỘT quán, tính từ end_date.
 *
 * Một hàm dùng chung cho cả ba nơi cảnh báo (chuông, banner, chấm ở dropdown quán)
 * để ngưỡng không lệch nhau — chuông báo mà banner im, hay ngược lại, thì người
 * dùng không biết tin cái nào.
 *
 * 'none' = quán chưa có gói nào (khác hẳn 'expired' = từng có nhưng đã hết).
 */
export function expiryState(endDate: string | null | undefined): ExpiryState {
  if (!endDate) return 'none';
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return 'none';
  if (end <= Date.now()) return 'expired';
  return daysLeftUntil(endDate) <= EXPIRY_SOON_DAYS ? 'soon' : 'ok';
}

/**
 * Số ngày còn lại, làm tròn LÊN: còn 4 tiếng vẫn là "1 ngày" chứ không phải 0.
 * Nói "còn 0 ngày" trong khi gói vẫn dùng được thì vừa sai vừa gây hoảng.
 */
export function daysLeftUntil(endDate: string): number {
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

// Được phép thao tác ghi (thêm/sửa/xóa/bán hàng): có gói hiệu lực VÀ chưa hết hạn.
// Xem dữ liệu (kể cả doanh thu, in hóa đơn) không dùng cổng này — vẫn cho phép khi hết hạn.
export function canManage(sub: UserSubscription | null | undefined): boolean {
  return (sub?.packageType ?? 'none') !== 'none' && !isSubscriptionExpired(sub);
}

// Không có canEdit(): canManage() ở trên thay thế nó (canEdit chỉ xét loại gói,
// bỏ qua việc gói đã hết hạn hay chưa).
//
// Không có canViewRevenue(): xem doanh thu là quyền CƠ BẢN của mọi người dùng, kể cả
// khi chưa có gói hoặc gói đã hết hạn — đó là dữ liệu bán hàng của chính chủ quán, và
// backend cũng cho đọc order không cần gói (GET cafes/{cafe}/orders không gắn
// middleware subscription). Từng có một hàm luôn trả `true` ở đây; giữ nó chỉ khiến
// người đọc tưởng chỗ này có phân quyền.

// Trợ lý AI & phân tích doanh thu — chỉ gói có bật can_use_ai (mặc định chỉ Pro Max).
export function canUseAI(sub: UserSubscription | null | undefined): boolean {
  return packageLimits(sub).canUseAI;
}

export function canPrint(pkg: UserPackageType): boolean {
  return pkg !== 'none';
}

export function getPackageBadgeClass(type: string): string {
  switch (type) {
    case 'free': return 'badge-free';
    case 'pro': return 'badge-pro';
    case 'promax': return 'badge-promax';
    default: return 'badge-inactive';
  }
}
