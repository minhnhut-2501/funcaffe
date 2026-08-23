/** Tài khoản nhân viên của quán đang chọn. */
import { api } from '@/lib/api-client';
import { getShopId } from './shop-id';

export interface NhanVien {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: 'active' | 'locked';
  createdAt?: string;
}

function mapNhanVien(raw: any): NhanVien {
  return {
    id: raw.id ?? raw._id ?? '',
    fullName: raw.full_name ?? '',
    email: raw.email ?? '',
    phone: raw.phone ?? '',
    // Bản ghi thiếu/hỏng trường này thì coi là ĐANG LÀM, không phải đã khóa: hiện
    // nhầm "đã khóa" khiến chủ quán tưởng mình vừa chặn mất người đang đứng quầy.
    status: raw.status === 'locked' ? 'locked' : 'active',
    createdAt: raw.created_at,
  };
}

export const staffService = {
  list: async () => {
    const shopId = await getShopId();
    const ds = await api.get<any[]>(`/shops/${shopId}/staff`);
    return ds.map(mapNhanVien);
  },

  create: async (data: { fullName: string; email: string; phone?: string; password: string }) => {
    const shopId = await getShopId();
    const raw = await api.post<any>(`/shops/${shopId}/staff`, {
      full_name: data.fullName,
      email: data.email,
      phone: data.phone ?? '',
      password: data.password,
    });
    return mapNhanVien(raw);
  },

  update: async (id: string, data: { fullName?: string; phone?: string; status?: 'active' | 'locked' }) => {
    const shopId = await getShopId();
    const body: Record<string, unknown> = {};
    if (data.fullName !== undefined) body.full_name = data.fullName;
    if (data.phone !== undefined) body.phone = data.phone;
    if (data.status !== undefined) body.status = data.status;
    const raw = await api.put<any>(`/shops/${shopId}/staff/${id}`, body);
    return mapNhanVien(raw);
  },

  /**
   * Chủ quán đặt lại mật khẩu cho nhân viên. Không hỏi mật khẩu cũ — chủ quán không
   * biết và cũng không cần biết; quyền này đến từ việc sở hữu quán.
   */
  datLaiMatKhau: async (id: string, password: string) => {
    const shopId = await getShopId();
    await api.put(`/shops/${shopId}/staff/${id}/password`, { password });
  },

  // KHÔNG có remove(): nhân viên đã bán hàng nằm trong orders.created_by / paid_by,
  // xóa là hóa đơn cũ mất tên người thu. Dùng update(id, { status: 'locked' }).
};
