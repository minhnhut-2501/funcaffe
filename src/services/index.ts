import type {
  MenuItem, MenuItemSize, Category, Topping, CafeTable,
  Order, OrderItem, Invoice, CafeInfo, Package, User, Payment,
  TimeSubscription, Review, PublicReview, MyPayment,
} from '@/types';
import { api, type SubscriptionData } from '@/lib/api-client';

let cafeIdCache: string | null = null;

async function getCafeId(): Promise<string> {
  if (cafeIdCache) return cafeIdCache;
  const cafes = await api.get<Array<{ id: string }>>('/cafes');
  if (cafes.length === 0) throw new Error('NO_CAFE');
  cafeIdCache = cafes[0].id;
  return cafeIdCache;
}

function getCafeIdSync(): string | null {
  return cafeIdCache;
}

export async function hasCafe(): Promise<boolean> {
  try {
    const cafes = await api.get<Array<{ id: string }>>('/cafes');
    return cafes.length > 0;
  } catch { return false; }
}

export async function createCafe(data: { name: string; address?: string; phone?: string }): Promise<{ id: string }> {
  const raw = await api.post<any>('/cafes', data);
  cafeIdCache = raw.id ?? raw._id;
  return raw;
}

export function clearCafeCache() { cafeIdCache = null; }

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

function mapInvoice(raw: any): Invoice {
  const order = raw.order ?? {};
  const cafeSnapshot = raw.cafe_snapshot ?? {};
  const tableSnapshot = raw.table_snapshot ?? {};
  const tableName = tableSnapshot.name || order.table?.name || '';

  // BUG-07 FIX: Dùng invoice.items snapshot thay vì order.order_details
  const invoiceItems: OrderItem[] = (raw.items ?? []).map((item: any) => ({
    id: '',
    itemId: '',
    itemNameSnapshot: item.item_name ?? '',
    sizeNameSnapshot: item.size_name ?? undefined,
    quantity: item.quantity ?? 0,
    unitPrice: item.unit_price ?? 0,
    subtotal: item.item_subtotal ?? 0,
    toppingTotal: item.topping_total ?? 0,
    totalPrice: item.total_price ?? 0,
    toppings: (item.toppings ?? []).map((t: any) => ({
      toppingId: '',
      toppingNameSnapshot: t.topping_name ?? '',
      quantity: t.quantity ?? 0,
      priceAtTime: t.price ?? 0,
      subtotal: t.subtotal ?? 0,
    })),
    note: item.note ?? undefined,
  }));

  return {
    id: raw.id ?? raw._id,
    invoiceCode: raw.invoice_code,
    orderId: raw.order_id,
    cafeId: raw.cafe_id ?? undefined,
    tableId: raw.table_id ?? undefined,
    orderCode: order.code ?? '',
    tableName,
    cafeName: cafeSnapshot.name,
    cafeAddress: cafeSnapshot.address,
    cafePhone: cafeSnapshot.phone,
    items: invoiceItems,
    subtotal: raw.subtotal ?? 0,
    discountAmount: raw.discount_amount ?? 0,
    totalAmount: raw.total_amount ?? 0,
    paymentMethod: raw.payment_method,
    status: raw.payment_status === 'refunded' ? 'refunded' : 'paid',
    createdAt: raw.created_at,
    paidAt: raw.paid_at ?? '',
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
    refundAmount: raw.refund_amount ?? 0,
    refundStatus: raw.refund_status ?? 'none',
    refundNote: raw.refund_note ?? undefined,
    refundedAt: raw.refunded_at ?? undefined,
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
    const raw = await api.put<any>(`/cafes/${cafeId}/items/${id}`, body);
    return mapItem(raw);
  },
  remove: async (id: string) => {
    const cafeId = await getCafeId();
    await api.delete(`/cafes/${cafeId}/items/${id}`);
  },
};

// Categories
export const categoryService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/categories`);
    return items.map(mapId);
  },
  create: async (data: { name: string; description?: string; is_active?: boolean }) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/categories`, data);
    return mapId(raw);
  },
  update: async (id: string, data: { name?: string; description?: string; is_active?: boolean; isActive?: boolean }) => {
    const cafeId = await getCafeId();
    const raw = await api.put<any>(`/cafes/${cafeId}/categories/${id}`, data);
    return mapId(raw);
  },
  remove: async (id: string) => {
    const cafeId = await getCafeId();
    await api.delete(`/cafes/${cafeId}/categories/${id}`);
  },
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
    });
    return mapTopping(raw);
  },
  update: async (id: string, data: Partial<Topping>) => {
    const cafeId = await getCafeId();
    const body: any = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.price !== undefined) body.price = data.price;
    if (data.isAvailable !== undefined) body.is_available = data.isAvailable;
    const raw = await api.put<any>(`/cafes/${cafeId}/toppings/${id}`, body);
    return mapTopping(raw);
  },
  remove: async (id: string) => {
    const cafeId = await getCafeId();
    await api.delete(`/cafes/${cafeId}/toppings/${id}`);
  },
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
  pay: async (orderId: string, data: { payment_method: string; discount_amount?: number }) => {
    const cafeId = await getCafeId();
    const raw = await api.post<any>(`/cafes/${cafeId}/orders/${orderId}/pay`, data);
    return raw;
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

// Invoices
export const invoiceService = {
  list: async () => {
    const cafeId = await getCafeId();
    const items = await api.get<any[]>(`/cafes/${cafeId}/invoices`);
    return items.map(mapInvoice);
  },
  getById: async (id: string) => {
    const cafeId = await getCafeId();
    const raw = await api.get<any>(`/cafes/${cafeId}/invoices/${id}`);
    return mapInvoice(raw);
  },
};

// Cafe Info
export const cafeService = {
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

// Subscriptions
export const subscriptionService = {
  list: async () => {
    const items = await api.get<any[]>('/subscriptions');
    return items.map((raw: any) => ({
      id: raw.id ?? raw._id,
      packageId: raw.package_id,
      package: raw.package ? mapPackage(raw.package) : undefined,
      timeSubscriptionId: raw.time_subscription_id,
      packageNameSnapshot: raw.package_name_snapshot,
      startDate: raw.start_date,
      endDate: raw.end_date,
      subtotal: raw.subtotal,
      totalAmount: raw.total_amount,
      status: raw.status,
      isPendingReview: raw.is_pending_review ?? false,
      actionType: raw.action_type ?? null,
      createdAt: raw.created_at,
    }));
  },
  active: async () => {
    const raw = await api.get<any>('/subscriptions/active');
    return raw ? {
      id: raw.id ?? raw._id,
      packageId: raw.package_id,
      package: raw.package ? mapPackage(raw.package) : undefined,
      timeSubscriptionId: raw.time_subscription_id,
      packageNameSnapshot: raw.package_name_snapshot,
      startDate: raw.start_date,
      endDate: raw.end_date,
      subtotal: raw.subtotal,
      totalAmount: raw.total_amount,
      status: raw.status,
      isPendingReview: raw.is_pending_review ?? false,
      actionType: raw.action_type ?? null,
      createdAt: raw.created_at,
    } : null;
  },
  create: async (data: { package_id: string; time_subscription_id?: string; payment_method: string; note?: string }) => {
    const raw = await api.post<any>('/subscriptions', data);
    return raw;
  },
  // Lịch sử thanh toán gói của chính user
  payments: async (): Promise<MyPayment[]> => {
    const items = await api.get<any[]>('/subscriptions/payments');
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
      refundAmount: raw.refund_amount ?? 0,
      refundStatus: raw.refund_status ?? 'none',
    } as MyPayment));
  },
};

// Payments (admin)
export const paymentService = {
  list: async () => {
    const items = await api.get<any[]>('/admin/payments');
    return items.map(mapPayment);
  },
  approve: async (id: string) => {
    await api.put(`/admin/payments/${id}/approve`);
  },
  reject: async (id: string) => {
    await api.put(`/admin/payments/${id}/reject`);
  },
  reset: async (id: string) => {
    await api.put(`/admin/payments/${id}/reset`);
  },
  update: async (id: string, data: { amount?: number; note?: string }) => {
    const raw = await api.put<any>(`/admin/payments/${id}`, data);
    return mapPayment(raw);
  },
  // #4: Admin xác nhận / từ chối hoàn tiền khi nâng cấp gói
  approveRefund: async (id: string, refund_note?: string) => {
    const raw = await api.put<any>(`/admin/payments/${id}/refund/approve`, { refund_note });
    return mapPayment(raw);
  },
  rejectRefund: async (id: string, refund_note?: string) => {
    const raw = await api.put<any>(`/admin/payments/${id}/refund/reject`, { refund_note });
    return mapPayment(raw);
  },
};

// Contact
export const contactService = {
  send: async (data: { full_name: string; email: string; phone?: string; cafe_name?: string; content: string }) => {
    return api.post<{ message: string }>('/contact', data);
  },
};

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
  create: async (cafeId: string, data: {
    rating: number;
    title?: string;
    comment?: string;
  }) => {
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
