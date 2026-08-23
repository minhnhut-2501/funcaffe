/** Thực đơn: món, danh mục, topping. */
import type { Category, Product, Topping } from '@/types';
import { api } from '@/lib/api-client';
import type { RawProduct, RawProductSize, RawProductTopping, RawTopping, RawCategory } from './raw';
import { getShopId } from './shop-id';

function mapItem(raw: RawProduct): Product {
  return {
    id: raw.id ?? raw._id ?? '',
    name: raw.name ?? '',
    basePrice: raw.base_price ?? 0,
    categoryId: raw.category_id ?? '',
    imageUrl: raw.image ?? undefined,
    description: raw.description ?? undefined,
    hasSize: raw.has_size ?? false,
    sizes: (raw.product_sizes ?? []).map((ip: RawProductSize) => ({
      id: ip._id ?? ip.id ?? '',
      sizeId: undefined,
      name: ip.size_name ?? ip.size?.name ?? '',
      price: ip.price ?? 0,
      isActive: ip.is_active ?? true,
    })),
    hasTopping: raw.has_topping ?? false,
    // Lọc bỏ bản ghi hỏng thay vì để lọt `undefined` vào danh sách id topping.
    allowedToppingIds: (raw.product_toppings ?? []).map((it: RawProductTopping) => it.topping_id).filter((id): id is string => !!id),
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
    const shopId = await getShopId();
    const items = await api.get<RawProduct[]>(`/shops/${shopId}/products`);
    return items.map(mapItem);
  },
  create: async (data: Partial<Product>) => {
    const shopId = await getShopId();
    const body: Record<string, unknown> = {
      name: data.name,
      category_id: data.categoryId,
      base_price: data.basePrice,
      has_size: data.hasSize,
      has_topping: data.hasTopping,
      is_available: data.isAvailable ?? true,
      image: data.imageUrl,
      description: data.description,
      sizes: (data.sizes ?? []).map(s => ({ name: s.name, price: s.price, is_active: s.isActive })),
      // Topping gắn cho món (gộp vào form món). Không cho phép topping -> gửi rỗng.
      topping_ids: data.hasTopping ? (data.allowedToppingIds ?? []) : [],
    };
    const raw = await api.post<RawProduct>(`/shops/${shopId}/products`, body);
    return mapItem(raw);
  },
  update: async (id: string, data: Partial<Product>) => {
    const shopId = await getShopId();
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.categoryId !== undefined) body.category_id = data.categoryId;
    if (data.basePrice !== undefined) body.base_price = data.basePrice;
    if (data.hasSize !== undefined) body.has_size = data.hasSize;
    if (data.hasTopping !== undefined) body.has_topping = data.hasTopping;
    if (data.isAvailable !== undefined) body.is_available = data.isAvailable;
    if (data.imageUrl !== undefined) body.image = data.imageUrl;
    if (data.description !== undefined) body.description = data.description;
    if (data.sizes !== undefined) body.sizes = data.sizes.map(s => ({ name: s.name, price: s.price, is_active: s.isActive }));
    // Chỉ đồng bộ topping khi form có gửi allowedToppingIds (tránh xóa nhầm khi chỉ toggle trạng thái).
    if (data.allowedToppingIds !== undefined) body.topping_ids = data.hasTopping === false ? [] : (data.allowedToppingIds ?? []);
    const raw = await api.put<RawProduct>(`/shops/${shopId}/products/${id}`, body);
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
    const shopId = await getShopId();
    const items = await api.get<RawCategory[]>(`/shops/${shopId}/categories`);
    return items.map(mapCategory);
  },
  create: async (data: { name: string; description?: string; is_active?: boolean }) => {
    const shopId = await getShopId();
    const raw = await api.post<RawCategory>(`/shops/${shopId}/categories`, data);
    return mapCategory(raw);
  },
  update: async (id: string, data: { name?: string; description?: string; is_active?: boolean; isActive?: boolean }) => {
    const shopId = await getShopId();
    const raw = await api.put<RawCategory>(`/shops/${shopId}/categories/${id}`, data);
    return mapCategory(raw);
  },
  // Không có remove: danh mục chỉ ẨN (is_active=false) — xóa sẽ bỏ rơi món bên trong.
};

// Toppings
export const toppingService = {
  list: async () => {
    const shopId = await getShopId();
    const items = await api.get<RawTopping[]>(`/shops/${shopId}/toppings`);
    return items.map(mapTopping);
  },
  create: async (data: Partial<Topping>) => {
    const shopId = await getShopId();
    const raw = await api.post<RawTopping>(`/shops/${shopId}/toppings`, {
      name: data.name,
      price: data.price,
      is_available: data.isAvailable ?? true,
      // BUG-FIX: trước đây quên gửi image -> ảnh topping upload xong bị vứt
      image: data.imageUrl ?? null,
    });
    return mapTopping(raw);
  },
  update: async (id: string, data: Partial<Topping>) => {
    const shopId = await getShopId();
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.price !== undefined) body.price = data.price;
    if (data.isAvailable !== undefined) body.is_available = data.isAvailable;
    if (data.imageUrl !== undefined) body.image = data.imageUrl ?? null;
    const raw = await api.put<RawTopping>(`/shops/${shopId}/toppings/${id}`, body);
    return mapTopping(raw);
  },
  // Không có remove: topping chỉ ẨN (is_available=false) — topping từng bán còn trong hóa đơn cũ.
};
