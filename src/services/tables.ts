/** Bàn của quán. */
import type { CafeTable } from '@/types';
import { api } from '@/lib/api-client';
import type { RawTable } from './raw';
import { getCafeId } from './cafe-id';

function mapTable(raw: RawTable): CafeTable {
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
    const cafeId = await getCafeId();
    const items = await api.get<RawTable[]>(`/cafes/${cafeId}/tables`);
    return items.map(mapTable);
  },
  create: async (data: Partial<CafeTable>) => {
    const cafeId = await getCafeId();
    const raw = await api.post<RawTable>(`/cafes/${cafeId}/tables`, {
      name: data.name,
      capacity: data.capacity,
      status: data.status ?? 'empty',
    });
    return mapTable(raw);
  },
  update: async (id: string, data: Partial<CafeTable>) => {
    const cafeId = await getCafeId();
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.capacity !== undefined) body.capacity = data.capacity;
    if (data.status !== undefined) body.status = data.status;
    const raw = await api.put<RawTable>(`/cafes/${cafeId}/tables/${id}`, body);
    return mapTable(raw);
  },
  remove: async (id: string) => {
    const cafeId = await getCafeId();
    await api.delete(`/cafes/${cafeId}/tables/${id}`);
  },
};
