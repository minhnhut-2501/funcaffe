/** Gói dịch vụ và các mốc thời hạn. */
import type { Package, TimeSubscription } from '@/types';
import { api } from '@/lib/api-client';

/**
 * Danh sách tính năng — LUÔN trả về mảng chuỗi, dù máy chủ gửi gì.
 *
 * `raw.features ?? []` là chưa đủ: nếu máy chủ gửi một CHUỖI JSON (dữ liệu cũ được
 * ghi lúc model còn ép kiểu 'array'), phép hợp nhất đó cho chuỗi đi qua nguyên vẹn,
 * rồi `features.map(...)` ném lỗi và làm TRẮNG cả trang Bảng giá. Đã xảy ra thật trên
 * bản triển khai.
 *
 * Một trang công khai không được sập chỉ vì một trường dữ liệu sai hình dạng. Máy chủ
 * đã vá ở `Package::getFeaturesAttribute()`, nhưng giao diện tự đứng vững thì không
 * phụ thuộc vào phiên bản máy chủ đang chạy.
 */
function danhSachTinhNang(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const daGiaiMa = JSON.parse(raw);
      if (Array.isArray(daGiaiMa)) return daGiaiMa.map(String);
    } catch {
      // Không phải JSON — coi cả chuỗi là một mục, còn hơn mất trắng.
    }
    return [raw];
  }
  return [];
}

export function mapPackage(raw: any): Package {
  return {
    id: raw.id ?? raw._id,
    name: raw.name,
    type: (raw.type as Package['type']) ?? 'free',
    level: raw.level ?? 0,
    isTrial: raw.is_trial ?? false,
    description: raw.description ?? '',
    isActive: raw.status === 'active',
    features: danhSachTinhNang(raw.features),
    maxTables: raw.max_tables ?? null,
    maxMenuItems: raw.max_menu_items ?? null,
    canUseAI: raw.can_use_ai ?? false,
    vatRate: raw.vat_rate ?? undefined,
  };
}

// Packages
export const packageService = {
  /**
   * Endpoint CÔNG KHAI — chỉ trả gói đang bật (backend lọc status='active').
   * Dùng cho trang chủ, bảng giá, trang mua gói.
   */
  list: async () => {
    const items = await api.get<any[]>('/packages');
    return items.map(mapPackage);
  },
  /**
   * Bản dành cho ADMIN — trả cả gói đã tắt (status 'inactive').
   * Trang quản trị BẮT BUỘC dùng hàm này: `update` bên dưới cho phép đặt gói về
   * 'inactive', mà endpoint công khai lại lọc mất gói đó — dùng nhầm `list` thì tắt
   * một gói là nó biến mất khỏi danh sách và không còn cách nào bật lại.
   */
  adminList: async () => {
    const items = await api.get<any[]>('/admin/packages');
    return items.map(mapPackage);
  },
  update: async (id: string, data: Partial<Package>) => {
    const body: any = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.isActive !== undefined) body.status = data.isActive ? 'active' : 'inactive';
    if (data.description !== undefined) body.description = data.description;
    if (data.features !== undefined) body.features = data.features;
    if (data.maxTables !== undefined) body.max_tables = data.maxTables;
    if (data.maxMenuItems !== undefined) body.max_menu_items = data.maxMenuItems;
    if (data.canUseAI !== undefined) body.can_use_ai = data.canUseAI;
    const raw = await api.put<any>(`/admin/packages/${id}`, body);
    return mapPackage(raw);
  },
};

// Time Subscriptions
function mapTimeSubscription(raw: any): TimeSubscription {
  return {
    id: raw.id ?? raw._id,
    packageId: raw.package_id,
    durationValue: raw.duration_value,
    durationUnit: raw.duration_unit,
    price: raw.price,
    label: raw.label,
    status: raw.status,
  } as TimeSubscription;
}

export const timeSubscriptionService = {
  // Endpoint CÔNG KHAI — chỉ trả mốc đang bật. Dùng cho trang chủ, bảng giá,
  // trang mua gói: khách không được thấy mốc đã ẩn.
  listByPackage: async (packageId: string) => {
    const items = await api.get<any[]>(`/packages/${packageId}/time-subscriptions`);
    return items.map(mapTimeSubscription);
  },
  /**
   * Bản dành cho ADMIN — trả cả mốc đã ẩn (status 'inactive').
   * Trang quản trị KHÔNG được dùng listByPackage: endpoint công khai lọc mất mốc
   * đã ẩn, nên ẩn xong là mốc đó biến khỏi giao diện và không có đường bật lại.
   */
  adminListByPackage: async (packageId: string) => {
    const items = await api.get<any[]>('/admin/time-subscriptions');
    return items
      .map(mapTimeSubscription)
      .filter((t) => String(t.packageId) === String(packageId));
  },
  create: async (data: { package_id: string; duration_value: number; duration_unit: 'day' | 'month'; price: number; label: string; status?: string }) => {
    const raw = await api.post<any>('/admin/time-subscriptions', data);
    return raw;
  },
  update: async (id: string, data: Partial<TimeSubscription>) => {
    return api.put(`/admin/time-subscriptions/${id}`, data);
  },
  /**
   * ẨN một mốc thời hạn. Backend KHÔNG xóa khỏi CSDL dù route là DELETE — các
   * subscription đã bán còn trỏ tới bản ghi này để tính ngày gia hạn.
   */
  hide: async (id: string) => {
    await api.delete(`/admin/time-subscriptions/${id}`);
  },
};
