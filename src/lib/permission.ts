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
  pro:    { maxTables: 10,       maxMenuItems: 15,       canUseAI: false },
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

// Được phép thao tác ghi (thêm/sửa/xóa/bán hàng): có gói hiệu lực VÀ chưa hết hạn.
// Xem dữ liệu (kể cả doanh thu, in hóa đơn) không dùng cổng này — vẫn cho phép khi hết hạn.
export function canManage(sub: UserSubscription | null | undefined): boolean {
  return (sub?.packageType ?? 'none') !== 'none' && !isSubscriptionExpired(sub);
}

export function canEdit(pkg: UserPackageType): boolean {
  return pkg !== 'none';
}

// Xem doanh thu là quyền CƠ BẢN của mọi người dùng — kể cả khi chưa có gói hoặc
// gói đã hết hạn/bị hủy. Đây là dữ liệu bán hàng của chính chủ quán; backend cũng
// cho đọc order không cần gói (GET cafes/{cafe}/orders không có middleware subscription).
// Giữ tham số để nơi gọi không phải đổi.
export function canViewRevenue(_sub?: UserSubscription | null | undefined): boolean {
  return true;
}

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
