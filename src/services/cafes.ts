/** Thông tin quán: tạo, đọc, cập nhật. */
import type { CafeInfo } from '@/types';
import { api } from '@/lib/api-client';
import { getCafeId, rawCafeId, setActiveCafeId } from './cafe-id';

export async function createCafe(data: { name: string; address?: string; phone?: string }): Promise<{ id: string }> {
  const raw = await api.post<any>('/cafes', data);
  const id = rawCafeId(raw);
  setActiveCafeId(id); // quán mới tạo trở thành quán đang chọn
  return { ...raw, id };
}

function mapCafe(raw: any): CafeInfo {
  return {
    id: raw.id ?? raw._id,
    name: raw.name,
    address: raw.address ?? '',
    phone: raw.phone ?? '',
    description: raw.description ?? undefined,
    logoUrl: raw.logo ?? undefined,
    status: (['open', 'closed', 'inactive'] as const).includes(raw.status) ? raw.status as 'open' | 'closed' | 'inactive' : 'open',
    bankBin: raw.bank_bin ?? undefined,
    bankAccountNumber: raw.bank_account_number ?? undefined,
    bankAccountName: raw.bank_account_name ?? undefined,
    // Chỉ có ở GET /cafes (danh sách). Các endpoint trả về một quán đơn lẻ không
    // đính kèm gói, nên undefined ở đó là bình thường chứ không phải "chưa có gói".
    packageType: raw.package_type ?? undefined,
    packageName: raw.package_name ?? undefined,
    packageEndDate: raw.package_end_date ?? undefined,
  };
}

// Cafe Info
export const cafeService = {
  // Danh sách tất cả quán của user (cho hub Quản lý quán + dropdown chuyển quán)
  list: async (): Promise<CafeInfo[]> => {
    const items = await api.get<any[]>('/cafes');
    return items.map(mapCafe);
  },
  get: async () => {
    const cafeId = await getCafeId();
    const raw = await api.get<any>(`/cafes/${cafeId}`);
    return mapCafe(raw);
  },
  update: async (data: Partial<CafeInfo>) => {
    const cafeId = await getCafeId();
    const body: any = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.address !== undefined) body.address = data.address;
    if (data.phone !== undefined) body.phone = data.phone;
    if (data.description !== undefined) body.description = data.description;
    if (data.logoUrl !== undefined) body.logo = data.logoUrl;
    if (data.status !== undefined) body.status = data.status;
    if (data.bankBin !== undefined) body.bank_bin = data.bankBin;
    if (data.bankAccountNumber !== undefined) body.bank_account_number = data.bankAccountNumber;
    if (data.bankAccountName !== undefined) body.bank_account_name = data.bankAccountName;
    const raw = await api.put<any>(`/cafes/${cafeId}`, body);
    return mapCafe(raw);
  },
};
