/** Thực đơn: món, danh mục, topping. */
import type { Category, MenuItem, Topping } from '@/types';
import { api } from '@/lib/api-client';
import type { RawItem, RawItemPrice, RawItemTopping, RawTopping, RawCategory } from './raw';
import { getCafeId } from './cafe-id';

function mapItem(raw: RawItem): MenuItem {
  return {
    id: raw.id ?? raw._id ?? '',
    name: raw.name ?? '',
    basePrice: raw.base_price ?? 0,
    categoryId: raw.category_id ?? '',
    imageUrl: raw.image ?? undefined,
    description: raw.description ?? undefined,
    hasSize: raw.has_size ?? false,
    sizes: (raw.item_prices ?? []).map((ip: RawItemPrice) => ({
      id: ip._id ?? ip.id ?? '',
      sizeId: undefined,
      name: ip.size_name ?? ip.size?.name ?? '',
      price: ip.price ?? 0,
      isActive: ip.is_active ?? true,
    })),
    allowTopping: raw.allow_topping ?? false,
    // Lọc bỏ bản ghi hỏng thay vì để lọt `undefined` vào danh sách id topping.
    allowedToppingIds: (raw.item_toppings ?? []).map((it: RawItemTopping) => it.topping_id).filter((id): id is string => !!id),
    isAvailable: raw.is_available ?? true,
  };
}

function mapTopping(raw: RawTopping): Topping {
  return {
    id: raw.id ?? raw._id ?? '',
    name: raw.name ?? '',
    price: raw.price ?? 0,
    imageUrl: raw.image ?? undefined,
    isAvailable: raw.is_available ?? true,
  };
}

// Không có authService ở đây: đăng nhập / đăng ký / đăng xuất / lấy thông tin người
// dùng đều nằm trong AuthContext, vì chúng phải cập nhật cả state của context (user,
// danh sách quán, quán đang chọn) chứ không chỉ gọi API. Từng có một bản sao đầy đủ
// ở đây nhưng không nơi nào gọi — hai bản song song là mời gọi sửa một bên quên bên kia.

// Menu items
export const menuService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<RawItem[]>(`/cafes/${cafeId}/items`);
    return items.map(mapItem);
  },
  create: async (data: Partial<MenuItem>) => {
    const cafeId = await getCafeId();
    const body: Record<string, unknown> = {
      name: data.name,
      category_id: data.categoryId,
      base_price: data.basePrice,
      has_size: data.hasSize,
      allow_topping: data.allowTopping,
      is_available: data.isAvailable ?? true,
      image: data.imageUrl,
      description: data.description,
      sizes: (data.sizes ?? []).map(s => ({ name: s.name, price: s.price, is_active: s.isActive })),
      // Topping gắn cho món (gộp vào form món). Không cho phép topping -> gửi rỗng.
      topping_ids: data.allowTopping ? (data.allowedToppingIds ?? []) : [],
    };
    const raw = await api.post<RawItem>(`/cafes/${cafeId}/items`, body);
    return mapItem(raw);
  },
  update: async (id: string, data: Partial<MenuItem>) => {
    const cafeId = await getCafeId();
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.categoryId !== undefined) body.category_id = data.categoryId;
    if (data.basePrice !== undefined) body.base_price = data.basePrice;
    if (data.hasSize !== undefined) body.has_size = data.hasSize;
    if (data.allowTopping !== undefined) body.allow_topping = data.allowTopping;
    if (data.isAvailable !== undefined) body.is_available = data.isAvailable;
    if (data.imageUrl !== undefined) body.image = data.imageUrl;
    if (data.description !== undefined) body.description = data.description;
    if (data.sizes !== undefined) body.sizes = data.sizes.map(s => ({ name: s.name, price: s.price, is_active: s.isActive }));
    // Chỉ đồng bộ topping khi form có gửi allowedToppingIds (tránh xóa nhầm khi chỉ toggle trạng thái).
    if (data.allowedToppingIds !== undefined) body.topping_ids = data.allowTopping === false ? [] : (data.allowedToppingIds ?? []);
    const raw = await api.put<RawItem>(`/cafes/${cafeId}/items/${id}`, body);
    return mapItem(raw);
  },
  // Không có remove: món chỉ được ẨN (update isAvailable=false), không xóa —
  // vì món từng bán còn được tham chiếu trong order/hóa đơn cũ.
};

// Categories
function mapCategory(raw: RawCategory): Category {
  return {
    id: raw.id ?? raw._id ?? '',
    name: raw.name ?? '',
    description: raw.description ?? undefined,
    isActive: raw.is_active ?? true,
  };
}

export const categoryService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<RawCategory[]>(`/cafes/${cafeId}/categories`);
    return items.map(mapCategory);
  },
  create: async (data: { name: string; description?: string; is_active?: boolean }) => {
    const cafeId = await getCafeId();
    const raw = await api.post<RawCategory>(`/cafes/${cafeId}/categories`, data);
    return mapCategory(raw);
  },
  update: async (id: string, data: { name?: string; description?: string; is_active?: boolean; isActive?: boolean }) => {
    const cafeId = await getCafeId();
    const raw = await api.put<RawCategory>(`/cafes/${cafeId}/categories/${id}`, data);
    return mapCategory(raw);
  },
  // Không có remove: danh mục chỉ ẨN (is_active=false) — xóa sẽ bỏ rơi món bên trong.
};

// Toppings
export const toppingService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<RawTopping[]>(`/cafes/${cafeId}/toppings`);
    return items.map(mapTopping);
  },
  create: async (data: Partial<Topping>) => {
    const cafeId = await getCafeId();
    const raw = await api.post<RawTopping>(`/cafes/${cafeId}/toppings`, {
      name: data.name,
      price: data.price,
      is_available: data.isAvailable ?? true,
      // BUG-FIX: trước đây quên gửi image -> ảnh topping upload xong bị vứt
      image: data.imageUrl ?? null,
    });
    return mapTopping(raw);
  },
  update: async (id: string, data: Partial<Topping>) => {
    const cafeId = await getCafeId();
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.price !== undefined) body.price = data.price;
    if (data.isAvailable !== undefined) body.is_available = data.isAvailable;
    if (data.imageUrl !== undefined) body.image = data.imageUrl ?? null;
    const raw = await api.put<RawTopping>(`/cafes/${cafeId}/toppings/${id}`, body);
    return mapTopping(raw);
  },
  // Không có remove: topping chỉ ẨN (is_available=false) — topping từng bán còn trong hóa đơn cũ.
};
