/** Người dùng (danh sách cho admin + hồ sơ cá nhân). */
import type { User } from '@/types';
import { api } from '@/lib/api-client';

function mapUser(raw: any): User {
  return {
    id: raw.id ?? raw._id,
    fullName: raw.full_name,
    email: raw.email,
    phone: raw.phone ?? '',
    avatar: raw.avatar ?? undefined,
    status: raw.status === 'locked' ? 'locked' : 'active',
    role: raw.role === 'admin' ? 'admin' : raw.role === 'user' ? 'user' : undefined,
    packageType: raw.package_type ?? 'none',
    packageName: raw.package_name ?? '',
    cafeName: raw.cafe_name ?? undefined,
    hasUsedFreeTrial: raw.has_used_free_trial ?? raw.hasUsedFreeTrial ?? undefined,
    createdAt: raw.created_at,
    // Các trường dưới chỉ có ở /admin/users; endpoint khác trả undefined là bình thường.
    cafes: Array.isArray(raw.cafes)
      ? raw.cafes.map((c: any) => ({
          id: c.id,
          name: c.name ?? '',
          address: c.address ?? '',
          status: (['open', 'closed', 'inactive'] as const).includes(c.status) ? c.status : 'open',
          packageType: c.package_type ?? 'none',
          packageName: c.package_name ?? '',
          packageEndDate: c.package_end_date ?? undefined,
        }))
      : undefined,
    cafeCount: raw.cafe_count ?? undefined,
    activePackageCount: raw.active_package_count ?? undefined,
    paymentCount: raw.payment_count ?? undefined,
    totalPaid: raw.total_paid ?? undefined,
    lastPaymentAt: raw.last_payment_at ?? undefined,
  };
}

// Users (admin)
export interface UserPage {
  items: User[];
  total: number;
  currentPage: number;
  lastPage: number;
}

export const userService = {
  /**
   * MỘT TRANG người dùng (backend phân trang 50/trang).
   *
   * Trước đây hàm này bỏ qua hoàn toàn phần phân trang trong phản hồi, nên admin chỉ
   * thấy 50 tài khoản mới nhất — tài khoản thứ 51 trở đi không tìm được, không khóa
   * được. Nơi gọi PHẢI dùng `lastPage` để cho người dùng đi tiếp.
   */
  list: async (page = 1): Promise<UserPage> => {
    const res = await api.get<any>(`/admin/users?page=${page}`);
    // Phòng trường hợp backend trả mảng trần (bản cũ chưa phân trang).
    if (Array.isArray(res)) {
      return { items: res.map(mapUser), total: res.length, currentPage: 1, lastPage: 1 };
    }
    return {
      items: (res.data ?? []).map(mapUser),
      total: res.total ?? 0,
      currentPage: res.current_page ?? 1,
      lastPage: res.last_page ?? 1,
    };
  },
  /**
   * TOÀN BỘ người dùng, gom qua nhiều trang.
   *
   * Chỉ dành cho thống kê cần đếm trên tất cả tài khoản (biểu đồ tăng trưởng ở trang
   * Doanh thu hệ thống). Đừng dùng cho bảng danh sách — hãy phân trang ở đó.
   */
  listAll: async (): Promise<User[]> => {
    const first = await userService.list(1);
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, first.lastPage - 1) }, (_, i) => userService.list(i + 2)),
    );
    return rest.reduce((all, p) => all.concat(p.items), first.items);
  },
  toggleLock: async (id: string) => {
    await api.put(`/admin/users/${id}/lock`);
  },
  updateProfile: async (data: { full_name?: string; phone?: string; avatar?: string }) => {
    const raw = await api.put<any>('/user', data);
    return mapUser(raw);
  },
  changePassword: async (data: { current_password: string; new_password: string; confirm_password: string }) => {
    return api.put<{ message: string }>('/user/password', data);
  },
};
