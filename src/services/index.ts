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

/**
 * Quán đang chọn theo phỏng đoán tốt nhất, KHÔNG gọi mạng: cache trong bộ nhớ,
 * hoặc lựa chọn đã lưu từ lần trước.
 *
 * Dùng để bắn trước request phụ thuộc quán song song với `GET /cafes` thay vì phải
 * chờ nó trả về. Giá trị này CHƯA được kiểm chứng — nơi gọi phải đối chiếu lại với
 * danh sách quán thật rồi bỏ kết quả nếu đoán sai.
 */
export function peekActiveCafeId(): string | null {
  return cafeIdCache ?? readStoredCafeId();
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
    status: 'paid',
    createdAt: raw.created_at,
    paidAt: raw.paid_at ?? '',
    cashReceived: raw.cash_received ?? undefined,
    changeAmount: raw.change_amount ?? undefined,
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
    // Chỉ có ở GET /cafes (danh sách). Các endpoint trả về một quán đơn lẻ không
    // đính kèm gói, nên undefined ở đó là bình thường chứ không phải "chưa có gói".
    packageType: raw.package_type ?? undefined,
    packageName: raw.package_name ?? undefined,
    packageEndDate: raw.package_end_date ?? undefined,
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
  // Người trả tiền nằm trên chính giao dịch; subscription không giữ user nữa.
  const usr = raw.user ?? sub.user ?? {};
  const rawStatus = raw.payment_status ?? 'pending';
  const status: Payment['status'] = ['paid', 'pending', 'failed', 'rejected'].includes(rawStatus)
    ? rawStatus as Payment['status']
    : 'pending';
  return {
    id: raw.id ?? raw._id,
    transactionCode: raw.transaction_code ?? '',
    userId: raw.user_id ?? sub.user_id ?? '',
    userName: usr.full_name ?? '',
    userEmail: usr.email ?? '',
    packageName: pkg.name ?? '',
    packageType: (pkg.type as Payment['packageType']) ?? 'free',
    // Thời hạn nằm ở quan hệ time_subscription. KHÔNG có trường `duration_months`
    // nào ở backend — trước đây đọc nó nên mọi giao dịch đều hiện "1 tháng".
    durationValue: raw.time_subscription?.duration_value ?? undefined,
    durationUnit: raw.time_subscription?.duration_unit ?? undefined,
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

// Không có authService ở đây: đăng nhập / đăng ký / đăng xuất / lấy thông tin người
// dùng đều nằm trong AuthContext, vì chúng phải cập nhật cả state của context (user,
// danh sách quán, quán đang chọn) chứ không chỉ gọi API. Từng có một bản sao đầy đủ
// ở đây nhưng không nơi nào gọi — hai bản song song là mời gọi sửa một bên quên bên kia.

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

// Không có itemToppingService: topping gắn cho món đi kèm ngay trong body của
// menuService.create/update (trường `topping_ids`), không qua endpoint riêng.

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
/**
 * Bộ lọc cho `GET /cafes/{cafe}/orders`.
 * Luôn truyền ít nhất `status`: không truyền gì là kéo về TOÀN BỘ lịch sử bán hàng
 * của quán kèm dòng món và topping.
 */
export interface OrderQuery {
  status?: 'active' | 'paid' | 'cancelled';
  from?: string;  // 'YYYY-MM-DD'
  to?: string;    // 'YYYY-MM-DD'
  limit?: number;
}

function orderQueryString(q: OrderQuery): string {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.limit) params.set('limit', String(q.limit));
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Thân request tạo/sửa đơn.
 *
 * KHÔNG gửi bất kỳ trường giá nào (`subtotal`, `total_amount`, `unit_price`,
 * `price_at_time`, và `subtotal` của từng dòng). Backend cố ý không nhận chúng —
 * `OrderController` tự đọc giá từ CSDL và tự lấy cả tên món/topping cho snapshot,
 * để client không quyết định được số tiền. Gửi lên thì Laravel cũng loại bỏ trong im
 * lặng vì chúng không nằm trong `validate()`.
 *
 * Giữ chúng lại chỉ có hại: payload phình vô ích, và người đọc code frontend tưởng
 * giá do frontend quyết định nên sẽ đi "sửa lỗi giá" ở đúng chỗ không có tác dụng.
 */
function orderBody(data: Partial<Order>) {
  return {
    table_id: data.tableId,
    note: data.note,
    discount_amount: data.discountAmount,
    items: (data.items ?? []).map((item) => ({
      item_id: item.itemId,
      item_name_snapshot: item.itemNameSnapshot,
      quantity: item.quantity,
      item_price_id: item.sizeId,
      size_name_snapshot: item.sizeNameSnapshot,
      note: item.note,
      toppings: (item.toppings ?? []).map((t) => ({
        topping_id: t.toppingId,
        topping_name_snapshot: t.toppingNameSnapshot,
        quantity: t.quantity,
      })),
    })),
  };
}

export const orderService = {
  /** Đơn ĐANG PHỤC VỤ. Màn hình Bán hàng chỉ cần chỗ này, không cần đơn đã đóng. */
  listActive: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/orders${orderQueryString({ status: 'active' })}`);
    return items.map(mapOrder);
  },
  list: async (query: OrderQuery = {}) => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/orders${orderQueryString(query)}`);
    return items.map(mapOrder);
  },
  getById: async (id: string) => {
    const cafeId = await getCafeId();
    const raw = await api.get<any>(`/cafes/${cafeId}/orders/${id}`);
    return mapOrder(raw);
  },
  create: async (data: Partial<Order>) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/orders`, orderBody(data));
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
    const raw = await api.put<any>(`/cafes/${cafeId}/orders/${id}`, orderBody(data));
    return mapOrder(raw);
  },
};

// "Hóa đơn" = order đã thanh toán (bảng invoices đã bị bỏ, order tự mang thanh toán).
export const invoiceService = {
  // status=paid lọc ở CSDL. Trước đây tải mọi đơn (kể cả đang phục vụ và đã hủy)
  // rồi mới `.filter(o => o.status === 'paid')` trong trình duyệt.
  list: async (query: Omit<OrderQuery, 'status'> = {}) => {
    const cafeId = await getCafeId();
    const orders = await api.get<any[]>(`/cafes/${cafeId}/orders${orderQueryString({ ...query, status: 'paid' })}`);
    return orders.map(mapInvoice);
  },
  /**
   * Hóa đơn của MỘT quán chỉ định (không phụ thuộc quán đang chọn).
   * Trang doanh thu dùng hàm này để gộp số liệu nhiều quán: /revenue/overview chỉ
   * trả về tổng và số theo tháng nên không đủ để lọc theo ngày hay tính top món.
   */
  listByCafe: async (cafeId: string, cafeName?: string, query: Omit<OrderQuery, 'status'> = {}) => {
    const orders = await api.get<any[]>(`/cafes/${cafeId}/orders${orderQueryString({ ...query, status: 'paid' })}`);
    return orders
      .map(mapInvoice)
      .map((inv) => ({ ...inv, cafeId, cafeName }));
  },
  getById: async (id: string) => {
    const cafeId = await getCafeId();
    const raw = await api.get<any>(`/cafes/${cafeId}/orders/${id}`);
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
  /**
   * Câu gợi ý mở đầu, chọn theo tình trạng thật của quán.
   *
   * Backend sinh chứ không ghi cứng ở đây: nó là nơi biết quán đang có bàn nào
   * phục vụ, hôm nay bán được gì — và cũng là nơi dựng ngữ cảnh gửi cho Gemini.
   * Hai bên cùng một nguồn thì không còn cảnh gợi ý hỏi thứ AI không trả lời được.
   * Endpoint này KHÔNG gọi Gemini, chỉ đếm dữ liệu.
   */
  suggestions: async (): Promise<string[]> => {
    const cafeId = await getCafeId();
    const res = await api.get<{ suggestions: string[] }>(`/cafes/${cafeId}/ai/suggestions`);
    return res.suggestions ?? [];
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
  /**
   * B6: admin đọc tin nhắn liên hệ từ trang public.
   * Backend phân trang; gom mọi trang lại (mỗi trang 200) để bảng bên admin vẫn tìm
   * kiếm và lọc tại chỗ như hiện tại, nhưng KHÔNG còn mất tin cũ như bản chặn cứng 200.
   */
  adminList: async (): Promise<ContactMessage[]> => {
    const first = await api.get<any>('/admin/contacts?per_page=200');
    if (Array.isArray(first)) return first.map(mapContact);

    const lastPage = first.last_page ?? 1;
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, lastPage - 1) }, (_, i) =>
        api.get<any>(`/admin/contacts?per_page=200&page=${i + 2}`)),
    );
    return [first, ...rest].flatMap((p) => (p.data ?? []).map(mapContact));
  },
  /** Đặt trạng thái đã đọc. Truyền giá trị mong muốn, không đảo — xem ContactController. */
  setRead: async (id: string, isRead: boolean) => {
    return api.put(`/admin/contacts/${id}/read`, { is_read: isRead });
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
      userEmail: raw.user_email ?? undefined,
      cafeId: raw.cafe_id,
      cafeName: raw.cafe_name ?? raw.cafe?.name ?? '',
      packageId: raw.package_id,
      packageName: raw.package_name ?? raw.package?.name ?? '',
      rating: raw.rating,
      title: raw.title ?? undefined,
      comment: raw.comment ?? undefined,
      status: raw.status,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at ?? raw.created_at,
      // Đánh giá tạo trước khi có tính năng lưu lịch sử sẽ không có field này.
      history: (raw.history ?? []).map((h: any) => ({
        rating: h.rating,
        title: h.title ?? undefined,
        comment: h.comment ?? undefined,
        writtenAt: h.written_at ?? undefined,
        replacedAt: h.replaced_at ?? undefined,
      })),
    } as Review));
  },
  getPublicReviews: async () => {
    const items = await api.get<any[]>(`/reviews`);
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      userId: raw.user_id,
      userName: raw.user_name ?? raw.user?.full_name ?? '',
      avatarUrl: raw.avatar ?? undefined,
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
  /**
   * Đánh giá FunCafe của chính người đang đăng nhập — KHÔNG đi qua quán đang chọn.
   * Mỗi tài khoản chỉ có một đánh giá, nên hỏi theo quán thì đổi sang quán chưa
   * đánh giá sẽ tưởng là chưa từng viết. Trả về null khi chưa viết.
   */
  mine: async (): Promise<Review | null> => {
    const raw = await api.get<any>('/reviews/mine');
    if (!raw) return null;
    return {
      id: raw.id ?? raw._id,
      userId: raw.user_id,
      userName: raw.user_name ?? '',
      cafeId: raw.cafe_id,
      cafeName: raw.cafe_name ?? '',
      packageId: raw.package_id,
      packageName: raw.package_name ?? '',
      rating: raw.rating,
      title: raw.title ?? undefined,
      comment: raw.comment ?? undefined,
      status: raw.status,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at ?? raw.created_at,
      history: (raw.history ?? []).map((h: any) => ({
        rating: h.rating,
        title: h.title ?? undefined,
        comment: h.comment ?? undefined,
        writtenAt: h.written_at ?? undefined,
        replacedAt: h.replaced_at ?? undefined,
      })),
    } as Review;
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
