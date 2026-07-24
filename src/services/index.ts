import type {
  MenuItem, MenuItemSize, Category, Topping, CafeTable,
  Order, OrderItem, Invoice, CafeInfo, Package, User, Payment,
  TimeSubscription, Review, PublicReview, MyPayment,
} from '@/types';
import { api, type SubscriptionData } from '@/lib/api-client';

// ĐA QUÁN: "quán đang chọn" (active café). Mọi endpoint cafes/{cafeId}/... dùng id này.
// Nhớ theo localStorage để giữ lựa chọn giữa các lần tải trang; xóa khi đăng xuất.
let cafeIdCache: string | null = null;
const ACTIVE_CAFE_KEY = 'funcafe.activeCafeId';

function readStoredCafeId(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(ACTIVE_CAFE_KEY); } catch { return null; }
}

// Đặt quán đang chọn (được gọi từ AuthContext khi đăng nhập / chuyển quán / tạo quán).
export function setActiveCafeId(id: string | null) {
  cafeIdCache = id;
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_CAFE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_CAFE_KEY);
  } catch { /* ignore */ }
}

function rawCafeId(c: any): string {
  return c?.id ?? c?._id;
}

// Chọn quán đang dùng từ danh sách id: ưu tiên quán đã chọn trước đó (cache/localStorage)
// nếu còn thuộc user, ngược lại lấy quán đầu. Trả về id đã chọn (và lưu lại).
export function pickActiveCafeId(cafeIds: string[]): string | null {
  if (cafeIds.length === 0) { setActiveCafeId(null); return null; }
  const current = cafeIdCache ?? readStoredCafeId();
  const chosen = current && cafeIds.includes(current) ? current : cafeIds[0];
  setActiveCafeId(chosen);
  return chosen;
}

async function getCafeId(): Promise<string> {
  if (cafeIdCache) return cafeIdCache;
  const cafes = await api.get<any[]>('/cafes');
  const ids = cafes.map(rawCafeId).filter(Boolean);
  if (ids.length === 0) throw new Error('NO_CAFE');
  const stored = readStoredCafeId();
  const chosen = stored && ids.includes(stored) ? stored : ids[0];
  setActiveCafeId(chosen);
  return chosen;
}

function getCafeIdSync(): string | null {
  return cafeIdCache;
}

export async function hasCafe(): Promise<boolean> {
  try {
    const cafes = await api.get<any[]>('/cafes');
    return cafes.length > 0;
  } catch { return false; }
}

export async function createCafe(data: { name: string; address?: string; phone?: string }): Promise<{ id: string }> {
  const raw = await api.post<any>('/cafes', data);
  const id = rawCafeId(raw);
  setActiveCafeId(id); // quán mới tạo trở thành quán đang chọn
  return { ...raw, id };
}

export function clearCafeCache() { setActiveCafeId(null); }

function mapId<T extends { _id: string }>(obj: T): Omit<T, '_id'> & { id: string } {
  const { _id, ...rest } = obj;
  return { id: _id, ...rest } as any;
}

export { getCafeId, getCafeIdSync };

function mapItem(raw: any): MenuItem {
  return {
    id: raw.id ?? raw._id,
    name: raw.name,
    basePrice: raw.base_price ?? 0,
    categoryId: raw.category_id,
    imageUrl: raw.image ?? undefined,
    description: raw.description ?? undefined,
    hasSize: raw.has_size ?? false,
    sizes: (raw.item_prices ?? []).map((ip: any) => ({
      id: ip._id ?? ip.id,
      sizeId: undefined,
      name: ip.size_name ?? ip.size?.name ?? '',
      price: ip.price,
      isActive: ip.is_active ?? true,
    })),
    allowTopping: raw.allow_topping ?? false,
    allowedToppingIds: (raw.item_toppings ?? []).map((it: any) => it.topping_id),
    isAvailable: raw.is_available ?? true,
  };
}

function mapTopping(raw: any): Topping {
  return {
    id: raw.id ?? raw._id,
    name: raw.name,
    price: raw.price,
    imageUrl: raw.image ?? undefined,
    isAvailable: raw.is_available ?? true,
  };
}

function mapTable(raw: any): CafeTable {
  return {
    id: raw.id ?? raw._id,
    name: raw.name,
    capacity: raw.capacity,
    status: raw.status ?? 'empty',
    currentOrderId: raw.current_order_id ?? undefined,
  };
}

function mapOrderItem(raw: any): OrderItem {
  return {
    id: raw.id ?? raw._id,
    itemId: raw.item_id,
    itemNameSnapshot: raw.item_name_snapshot ?? '',
    sizeId: raw.item_price_id ?? undefined,
    sizeNameSnapshot: raw.size_name_snapshot ?? undefined,
    quantity: raw.quantity,
    unitPrice: raw.unit_price,
    subtotal: raw.subtotal,
    toppingTotal: raw.topping_total ?? 0,
    totalPrice: raw.total_price ?? 0,
    toppings: (raw.order_detail_toppings ?? []).map((t: any) => ({
      toppingId: t.topping_id,
      toppingNameSnapshot: t.topping_name_snapshot || t.topping?.name || '',
      quantity: t.quantity,
      priceAtTime: t.price_at_time,
      subtotal: t.subtotal,
    })),
    note: raw.note ?? undefined,
  };
}

function mapOrder(raw: any): Order {
  return {
    id: raw.id ?? raw._id,
    code: raw.code ?? '',
    tableId: raw.table_id,
    tableName: raw.table?.name ?? '',
    items: (raw.order_details ?? []).map(mapOrderItem),
    subtotal: raw.subtotal ?? 0,
    discountAmount: raw.discount_amount ?? 0,
    totalAmount: raw.total_amount ?? 0,
    status: raw.status === 'paid' ? 'paid' : (raw.status === 'cancelled' ? 'cancelled' : 'active'),
    paymentStatus: raw.status === 'paid' ? 'paid' : 'unpaid',
    paymentMethod: raw.payment_method ?? undefined,
    note: raw.note ?? undefined,
    createdAt: raw.created_at,
    paidAt: raw.paid_at ?? undefined,
  };
}

/**
 * Đã bỏ bảng invoices — "hóa đơn" nay là VIEW của một order đã thanh toán.
 * mapInvoice nhận thẳng raw order (có invoice_code + field thanh toán + order_details).
 * Dòng món lấy từ order_details qua mapOrderItem (đã gồm topping snapshot).
 * Thông tin quán cho phiếu in do trang tự điền từ quán đang chọn (không snapshot).
 */
function mapInvoice(raw: any): Invoice {
  const items: OrderItem[] = (raw.order_details ?? []).map(mapOrderItem);

  return {
    id: raw.id ?? raw._id,
    invoiceCode: raw.invoice_code ?? raw.code ?? '',
    orderId: raw.id ?? raw._id,
    cafeId: raw.cafe_id ?? undefined,
    tableId: raw.table_id ?? undefined,
    orderCode: raw.code ?? '',
    tableName: raw.table?.name ?? '',
    cafeName: undefined,
    cafeAddress: undefined,
    cafePhone: undefined,
    items,
    subtotal: raw.subtotal ?? 0,
    discountAmount: raw.discount_amount ?? 0,
    totalAmount: raw.total_amount ?? 0,
    paymentMethod: raw.payment_method,
    status: raw.payment_status === 'refunded' ? 'refunded' : 'paid',
    createdAt: raw.created_at,
    paidAt: raw.paid_at ?? '',
    cashReceived: raw.cash_received ?? undefined,
    changeAmount: raw.change_amount ?? undefined,
    refundedAt: raw.refunded_at ?? undefined,
    refundReason: raw.refund_reason ?? undefined,
  };
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
  };
}

function mapPackage(raw: any): Package {
  return {
    id: raw.id ?? raw._id,
    name: raw.name,
    type: (raw.type as Package['type']) ?? 'free',
    level: raw.level ?? 0,
    isTrial: raw.is_trial ?? false,
    description: raw.description ?? '',
    isActive: raw.status === 'active',
    features: raw.features ?? [],
    maxTables: raw.max_tables ?? null,
    maxMenuItems: raw.max_menu_items ?? null,
    canUseAI: raw.can_use_ai ?? false,
    vatRate: raw.vat_rate ?? undefined,
  };
}

function mapUser(raw: any): User {
  return {
    id: raw.id ?? raw._id,
    fullName: raw.full_name,
    email: raw.email,
    phone: raw.phone ?? '',
    avatar: raw.avatar ?? undefined,
    status: raw.status === 'locked' ? 'locked' : 'active',
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

function mapPayment(raw: any): Payment {
  const sub = raw.subscription ?? {};
  const pkg = sub.package ?? raw.package ?? {};
  const usr = sub.user ?? raw.user ?? {};
  const rawStatus = raw.payment_status ?? 'pending';
  const status: Payment['status'] = ['paid', 'pending', 'failed', 'rejected'].includes(rawStatus)
    ? rawStatus as Payment['status']
    : 'pending';
  return {
    id: raw.id ?? raw._id,
    transactionCode: raw.transaction_code ?? '',
    userId: sub.user_id ?? '',
    userName: usr.full_name ?? '',
    userEmail: usr.email ?? '',
    packageName: pkg.name ?? '',
    packageType: (pkg.type as Payment['packageType']) ?? 'free',
    duration: raw.duration_months ?? 1,
    amount: raw.amount ?? 0,
    status,
    createdAt: raw.created_at,
    confirmedAt: raw.paid_at ?? undefined,
    note: raw.note ?? undefined,
    actionType: raw.action_type ?? undefined,
    creditAmount: raw.credit_amount ?? 0,
    creditStatus: raw.credit_status ?? 'none',
  };
}

// Auth
export const authService = {
  login: async (email: string, password: string) => {
    const res = await api.post<{ user: any; token: string }>('/auth/login', { email, password });
    api.setToken(res.token);
    return res;
  },
  register: async (data: { full_name: string; email: string; password: string; phone?: string }) => {
    const res = await api.post<{ user: any; token: string }>('/auth/register', data);
    api.setToken(res.token);
    return res;
  },
  logout: async () => {
    await api.post('/auth/logout');
    api.removeToken();
  },
  forgotPassword: async (email: string) => {
    return api.post<{ message: string }>('/auth/forgot-password', { email });
  },
  getUser: async () => {
    const raw = await api.get<any>('/user');
    return mapUser(raw);
  },
};

// Menu items
export const menuService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/items`);
    return items.map(mapItem);
  },
  listByCategory: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/items`);
    const categories = await categoryService.list();
    return categories.map((cat) => ({
      ...cat,
      items: items.filter((i) => i.categoryId === cat.id),
    }));
  },
  create: async (data: Partial<MenuItem>) => {
    const cafeId = await getCafeId();
    const body: any = {
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
    const raw = await api.post<any>(`/cafes/${cafeId}/items`, body);
    return mapItem(raw);
  },
  update: async (id: string, data: Partial<MenuItem>) => {
    const cafeId = await getCafeId();
    const body: any = {};
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
    const raw = await api.put<any>(`/cafes/${cafeId}/items/${id}`, body);
    return mapItem(raw);
  },
  // Không có remove: món chỉ được ẨN (update isAvailable=false), không xóa —
  // vì món từng bán còn được tham chiếu trong order/hóa đơn cũ.
};

// Categories
function mapCategory(raw: any): { id: string; name: string; description?: string; isActive: boolean } {
  return {
    id: raw.id ?? raw._id,
    name: raw.name,
    description: raw.description ?? undefined,
    isActive: raw.is_active ?? true,
  };
}

export const categoryService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/categories`);
    return items.map(mapCategory);
  },
  create: async (data: { name: string; description?: string; is_active?: boolean }) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/categories`, data);
    return mapCategory(raw);
  },
  update: async (id: string, data: { name?: string; description?: string; is_active?: boolean; isActive?: boolean }) => {
    const cafeId = await getCafeId();
    const raw = await api.put<any>(`/cafes/${cafeId}/categories/${id}`, data);
    return mapCategory(raw);
  },
  // Không có remove: danh mục chỉ ẨN (is_active=false) — xóa sẽ bỏ rơi món bên trong.
};

// Toppings
export const toppingService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/toppings`);
    return items.map(mapTopping);
  },
  create: async (data: Partial<Topping>) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/toppings`, {
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
    const body: any = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.price !== undefined) body.price = data.price;
    if (data.isAvailable !== undefined) body.is_available = data.isAvailable;
    if (data.imageUrl !== undefined) body.image = data.imageUrl ?? null;
    const raw = await api.put<any>(`/cafes/${cafeId}/toppings/${id}`, body);
    return mapTopping(raw);
  },
  // Không có remove: topping chỉ ẨN (is_available=false) — topping từng bán còn trong hóa đơn cũ.
};

// Item-Topping config
export const itemToppingService = {
  get: async (itemId: string) => {
    const cafeId = await getCafeId();
    const data = await api.get<string[]>(`/cafes/${cafeId}/items/${itemId}/toppings`);
    return data;
  },
  update: async (itemId: string, toppingIds: string[]) => {
    const cafeId = await getCafeId();
    const data = await api.put<{ topping_ids: string[] }>(`/cafes/${cafeId}/items/${itemId}/toppings`, { topping_ids: toppingIds });
    return data.topping_ids;
  },
};

// Tables
export const tableService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/tables`);
    return items.map(mapTable);
  },
  create: async (data: Partial<CafeTable>) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/tables`, {
      name: data.name,
      capacity: data.capacity,
      status: data.status ?? 'empty',
    });
    return mapTable(raw);
  },
  update: async (id: string, data: Partial<CafeTable>) => {
    const cafeId = await getCafeId();
    const body: any = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.capacity !== undefined) body.capacity = data.capacity;
    if (data.status !== undefined) body.status = data.status;
    const raw = await api.put<any>(`/cafes/${cafeId}/tables/${id}`, body);
    return mapTable(raw);
  },
  remove: async (id: string) => {
    const cafeId = await getCafeId();
    await api.delete(`/cafes/${cafeId}/tables/${id}`);
  },
};

// Orders
export const orderService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/orders`);
    return items.map(mapOrder);
  },
  getById: async (id: string) => {
    const cafeId = await getCafeId();
    const raw = await api.get<any>(`/cafes/${cafeId}/orders/${id}`);
    return mapOrder(raw);
  },
  create: async (data: Partial<Order>) => {
    const cafeId = await getCafeId();
    const body: any = {
      table_id: data.tableId,
      note: data.note,
      subtotal: data.subtotal,
      discount_amount: data.discountAmount,
      total_amount: data.totalAmount,
      items: (data.items ?? []).map((item) => ({
        item_id: item.itemId,
        item_name_snapshot: item.itemNameSnapshot,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
        item_price_id: item.sizeId,
        size_name_snapshot: item.sizeNameSnapshot,
        note: item.note,
        toppings: (item.toppings ?? []).map((t) => ({
          topping_id: t.toppingId,
          topping_name_snapshot: t.toppingNameSnapshot,
          quantity: t.quantity,
          price_at_time: t.priceAtTime,
          subtotal: t.subtotal,
        })),
      })),
    };
    const raw = await api.post<any>(`/cafes/${cafeId}/orders`, body);
    return mapOrder(raw);
  },
  pay: async (orderId: string, data: { payment_method: string; discount_amount?: number; cash_received?: number }) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/orders/${orderId}/pay`, data);
    return raw;
  },
  // Hủy order đang phục vụ -> đánh dấu 'cancelled' và trả bàn về trống.
  cancel: async (orderId: string) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/orders/${orderId}/cancel`, {});
    return mapOrder(raw);
  },
  update: async (id: string, data: Partial<Order>) => {
    const cafeId = await getCafeId();
    const body: any = {
      table_id: data.tableId,
      note: data.note,
      subtotal: data.subtotal,
      discount_amount: data.discountAmount,
      total_amount: data.totalAmount,
      items: (data.items ?? []).map((item) => ({
        item_id: item.itemId,
        item_name_snapshot: item.itemNameSnapshot,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
        item_price_id: item.sizeId,
        size_name_snapshot: item.sizeNameSnapshot,
        note: item.note,
        toppings: (item.toppings ?? []).map((t) => ({
          topping_id: t.toppingId,
          topping_name_snapshot: t.toppingNameSnapshot,
          quantity: t.quantity,
          price_at_time: t.priceAtTime,
          subtotal: t.subtotal,
        })),
      })),
    };
    const raw = await api.put<any>(`/cafes/${cafeId}/orders/${id}`, body);
    return mapOrder(raw);
  },
};

// "Hóa đơn" = order đã thanh toán (bảng invoices đã bị bỏ, order tự mang thanh toán).
export const invoiceService = {
  list: async () => {
    const cafeId = await getCafeId();
    const orders = await api.get<any[]>(`/cafes/${cafeId}/orders`);
    return orders.filter((o) => o.status === 'paid').map(mapInvoice);
  },
  getById: async (id: string) => {
    const cafeId = await getCafeId();
    const raw = await api.get<any>(`/cafes/${cafeId}/orders/${id}`);
    return mapInvoice(raw);
  },
  // C4: hoàn tiền order đã thanh toán (bắt buộc có lý do)
  refund: async (id: string, reason: string) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/orders/${id}/refund`, { reason });
    return mapInvoice(raw);
  },
};

// Trợ lý AI (chat + phân tích doanh thu). Quyền do BE chặn (middleware 'ai');
// FE khóa nút bằng canUseAI() cho gọn UX.
export interface AiRevenueAnalysis {
  tom_tat: string;
  diem_noi_bat: string[];
  canh_bao: string[];
  goi_y_hanh_dong: string[];
}
export interface AiRevenueResponse {
  analysis: AiRevenueAnalysis;
  stats: Record<string, unknown>;
  cached: boolean;
}
export const aiService = {
  chat: async (messages: { role: 'user' | 'assistant'; content: string }[]) => {
    const cafeId = await getCafeId();
    const res = await api.post<{ reply: string }>(`/cafes/${cafeId}/ai/chat`, { messages });
    return res.reply;
  },
  // Streaming: gọi onChunk(text) cho từng đoạn AI sinh ra (hiệu ứng gõ chữ).
  chatStream: async (
    messages: { role: 'user' | 'assistant'; content: string }[],
    onChunk: (text: string) => void,
  ): Promise<void> => {
    const cafeId = await getCafeId();
    const res = await api.postStream(`/cafes/${cafeId}/ai/chat/stream`, { messages });
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) onChunk(chunk);
    }
  },
  revenueAnalysis: async (refresh = false) => {
    const cafeId = await getCafeId();
    return api.post<AiRevenueResponse>(`/cafes/${cafeId}/ai/revenue-analysis`, { refresh });
  },
};

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

// Packages
export const packageService = {
  list: async () => {
    const items = await api.get<any[]>('/packages');
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

// Users (admin)
export const userService = {
  list: async () => {
    // BUG-16/BUG-26 FIX: Backend trả về paginated response {data: [...]}
    const res = await api.get<any>('/admin/users');
    const items = Array.isArray(res) ? res : (res.data ?? []);
    return items.map(mapUser);
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

// Subscriptions — ĐA QUÁN: gói theo quán đang chọn (cafes/{cafeId}/subscriptions)
export const subscriptionService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/subscriptions`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      packageId: raw.package_id,
      package: raw.package ? mapPackage(raw.package) : undefined,
      timeSubscriptionId: raw.time_subscription_id,
      packageNameSnapshot: raw.package_name_snapshot,
      startDate: raw.start_date,
      endDate: raw.end_date,
      // Chi tiết tiền (subtotal/VAT) và loại giao dịch nằm ở package_payments,
      // xem subscriptionService.payments(). Ở đây chỉ có tổng tiền của chu kỳ hiện hành.
      totalAmount: raw.total_amount,
      status: raw.status,
      isPendingReview: raw.is_pending_review ?? false,
      createdAt: raw.created_at,
    }));
  },
  active: async () => {
    const cafeId = await getCafeId();
    const raw = await api.get<any>(`/cafes/${cafeId}/subscriptions/active`);
    return raw ? {
      id: raw.id ?? raw._id,
      packageId: raw.package_id,
      package: raw.package ? mapPackage(raw.package) : undefined,
      timeSubscriptionId: raw.time_subscription_id,
      packageNameSnapshot: raw.package_name_snapshot,
      startDate: raw.start_date,
      endDate: raw.end_date,
      totalAmount: raw.total_amount,
      status: raw.status,
      isPendingReview: raw.is_pending_review ?? false,
      createdAt: raw.created_at,
    } : null;
  },
  create: async (data: { package_id: string; time_subscription_id?: string; payment_method: string; note?: string }) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/subscriptions`, data);
    return raw;
  },
  // Lịch sử thanh toán gói của quán đang chọn
  payments: async (): Promise<MyPayment[]> => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/subscriptions/payments`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      transactionCode: raw.transaction_code ?? '',
      packageName: raw.package?.name ?? '',
      amount: raw.amount ?? 0,
      paymentMethod: raw.payment_method ?? '',
      status: (['paid', 'pending', 'failed', 'rejected'].includes(raw.payment_status) ? raw.payment_status : 'pending'),
      actionType: raw.action_type ?? undefined,
      createdAt: raw.created_at,
      paidAt: raw.paid_at ?? undefined,
      creditAmount: raw.credit_amount ?? 0,
      creditStatus: raw.credit_status ?? 'none',
    } as MyPayment));
  },
};

// Tổng doanh thu gộp tất cả quán của user (đa quán)
export interface CafeRevenueRow {
  cafeId: string;
  cafeName: string;
  status: string;
  packageName: string | null;
  hasPackage: boolean;
  total: number;
  today: number;
  month: number;
}
export interface RevenueOverview {
  total: number;
  today: number;
  thisMonth: number;
  revenueByMonth: { month: string; revenue: number }[];
  cafes: CafeRevenueRow[];
}
export const revenueService = {
  overview: async (): Promise<RevenueOverview> => {
    const raw = await api.get<any>('/revenue/overview');
    return {
      total: raw.total ?? 0,
      today: raw.today ?? 0,
      thisMonth: raw.this_month ?? 0,
      revenueByMonth: Object.entries(raw.revenue_by_month ?? {}).map(([month, revenue]) => ({
        month, revenue: Number(revenue) || 0,
      })),
      cafes: (raw.cafes ?? []).map((c: any) => ({
        cafeId: c.cafe_id,
        cafeName: c.cafe_name,
        status: c.status,
        packageName: c.package_name ?? null,
        hasPackage: !!c.has_package,
        total: c.total ?? 0,
        today: c.today ?? 0,
        month: c.month ?? 0,
      })),
    };
  },
};

// Payments (admin)
export const paymentService = {
  list: async () => {
    const items = await api.get<any[]>('/admin/payments');
    return items.map(mapPayment);
  },
  // Chỉ đọc: số tiền là bản ghi tài chính từ cổng thanh toán, admin không sửa;
  // hoàn tiền khi nâng cấp giữa kỳ được cấn trừ tự động, không có duyệt tay.
};

// Contact
export interface ContactMessage {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  cafeName?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  /** Nội dung admin đã trả lời qua email (nếu đã trả lời). */
  reply?: string;
  repliedAt?: string;
  repliedBy?: string;
}

export const contactService = {
  send: async (data: { full_name: string; email: string; phone?: string; cafe_name?: string; content: string }) => {
    return api.post<{ message: string }>('/contact', data);
  },
  // B6: admin đọc tin nhắn liên hệ từ trang public
  adminList: async (): Promise<ContactMessage[]> => {
    const items = await api.get<any[]>('/admin/contacts');
    return items.map(mapContact);
  },
  toggleRead: async (id: string) => {
    return api.put(`/admin/contacts/${id}/read`);
  },
  /** Gửi email trả lời cho khách và lưu lại nội dung đã trả lời. */
  reply: async (id: string, reply: string): Promise<ContactMessage> => {
    const raw = await api.post<any>(`/admin/contacts/${id}/reply`, { reply });
    return mapContact(raw);
  },
};

function mapContact(raw: any): ContactMessage {
  return {
    id: raw.id ?? raw._id,
    fullName: raw.full_name ?? '',
    email: raw.email ?? '',
    phone: raw.phone || undefined,
    cafeName: raw.cafe_name || undefined,
    content: raw.content ?? '',
    isRead: raw.is_read ?? false,
    createdAt: raw.created_at,
    reply: raw.reply || undefined,
    repliedAt: raw.replied_at || undefined,
    repliedBy: raw.replied_by || undefined,
  };
}

// Time Subscriptions
export const timeSubscriptionService = {
  listByPackage: async (packageId: string) => {
    const items = await api.get<any[]>(`/packages/${packageId}/time-subscriptions`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      packageId: raw.package_id,
      durationValue: raw.duration_value,
      durationUnit: raw.duration_unit,
      price: raw.price,
      label: raw.label,
      status: raw.status,
    } as TimeSubscription));
  },
  list: async () => {
    const items = await api.get<any[]>('/admin/time-subscriptions');
    return items;
  },
  create: async (data: { package_id: string; duration_value: number; duration_unit: 'day' | 'month'; price: number; label: string; status?: string }) => {
    const raw = await api.post<any>('/admin/time-subscriptions', data);
    return raw;
  },
  update: async (id: string, data: Partial<TimeSubscription>) => {
    return api.put(`/admin/time-subscriptions/${id}`, data);
  },
  delete: async (id: string) => {
    await api.delete(`/admin/time-subscriptions/${id}`);
  },
};

// Reviews
export const reviewService = {
  // Gửi đánh giá FunCafe của chủ quán (backend upsert: gửi lại = cập nhật đánh giá cũ)
  create: async (data: {
    rating: number;
    title?: string;
    comment?: string;
  }) => {
    const cafeId = await getCafeId();
    return api.post(`/cafes/${cafeId}/reviews`, data);
  },
  adminList: async () => {
    const items = await api.get<any[]>('/admin/reviews');
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      userId: raw.user_id,
      userName: raw.user_name ?? '',
      cafeId: raw.cafe_id,
      cafeName: raw.cafe_name ?? raw.cafe?.name ?? '',
      packageId: raw.package_id,
      packageName: raw.package_name ?? raw.package?.name ?? '',
      rating: raw.rating,
      title: raw.title ?? undefined,
      comment: raw.comment ?? undefined,
      status: raw.status,
      createdAt: raw.created_at,
    }));
  },
  getPublicReviews: async () => {
    const items = await api.get<any[]>(`/reviews`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      userId: raw.user_id,
      userName: raw.user_name ?? raw.user?.full_name ?? '',
      cafeId: raw.cafe_id,
      cafeName: raw.cafe_name ?? raw.cafe?.name ?? '',
      packageId: raw.package_id,
      packageName: raw.package_name ?? raw.package?.name ?? '',
      rating: raw.rating,
      title: raw.title ?? undefined,
      comment: raw.comment ?? undefined,
      status: raw.status,
      createdAt: raw.created_at,
    } as PublicReview));
  },
  listByCafe: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/reviews`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      userId: raw.user_id,
      userName: raw.user_name ?? raw.user?.full_name ?? '',
      cafeId: raw.cafe_id,
      cafeName: raw.cafe?.name ?? '',
      packageId: raw.package_id,
      packageName: raw.package_name ?? raw.package?.name ?? '',
      rating: raw.rating,
      title: raw.title ?? undefined,
      comment: raw.comment ?? undefined,
      status: raw.status,
      createdAt: raw.created_at,
    } as Review));
  },
  toggleStatus: async (id: string) => {
    await api.put(`/admin/reviews/${id}/toggle`);
  },
};
