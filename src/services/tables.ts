/** Bàn của quán. */
import type { ShopTable } from '@/types';
import { api } from '@/lib/api-client';
import type { RawTable } from './raw';
import { getShopId } from './shop-id';

function mapTable(raw: RawTable): ShopTable {
  return {
    id: raw.id ?? raw._id ?? '',
    name: raw.name ?? '',
    // Bàn thiếu sức chứa thì ghi 0 chứ không để undefined — sơ đồ bàn in ra
    // "undefined chỗ" là lỗi nhìn thấy được ngay trên màn hình bán hàng.
    capacity: raw.capacity ?? 0,
    status: raw.status === 'serving' ? 'serving' : 'empty',
    currentOrderId: raw.current_order_id ?? undefined,
  };
}

// Không có itemToppingService: topping gắn cho món đi kèm ngay trong body của
// menuService.create/update (trường `topping_ids`), không qua endpoint riêng.

// Tables
export const tableService = {
  list: async () => {
    const shopId = await getShopId();
    const items = await api.get<RawTable[]>(`/shops/${shopId}/tables`);
    return items.map(mapTable);
  },
  create: async (data: Partial<ShopTable>) => {
    const shopId = await getShopId();
    const raw = await api.post<RawTable>(`/shops/${shopId}/tables`, {
      name: data.name,
      capacity: data.capacity,
      status: data.status ?? 'empty',
    });
    return mapTable(raw);
  },
  update: async (id: string, data: Partial<ShopTable>) => {
    const shopId = await getShopId();
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.capacity !== undefined) body.capacity = data.capacity;
    if (data.status !== undefined) body.status = data.status;
    const raw = await api.put<RawTable>(`/shops/${shopId}/tables/${id}`, body);
    return mapTable(raw);
  },
  remove: async (id: string) => {
    const shopId = await getShopId();
    await api.delete(`/shops/${shopId}/tables/${id}`);
  },
};
