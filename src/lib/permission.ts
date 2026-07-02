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
  free:   { maxTables: Infinity, maxMenuItems: Infinity, canUseAI: false },
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

export function canEdit(pkg: UserPackageType): boolean {
  return pkg !== 'none';
}

// Có gói đang hiệu lực ⇒ xem được doanh thu (mọi gói đều có quyền này).
export function canViewRevenue(sub: UserSubscription | null | undefined): boolean {
  return (sub?.packageType ?? 'none') !== 'none';
}

// Trợ lý AI (sắp ra mắt) — chỉ gói có bật can_use_ai (mặc định chỉ Pro Max).
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
