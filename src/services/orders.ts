/** Đơn hàng tại quầy và hóa đơn (hóa đơn = view của đơn đã thanh toán). */
import type { Invoice, Order, OrderItem } from '@/types';
import { api } from '@/lib/api-client';
import type { RawOrder, RawOrderDetail, RawOrderDetailTopping } from './raw';
import { getCafeId } from './cafe-id';

function mapOrderItem(raw: RawOrderDetail): OrderItem {
  return {
    id: raw.id ?? raw._id ?? '',
    itemId: raw.item_id ?? '',
    itemNameSnapshot: raw.item_name_snapshot ?? '',
    sizeId: raw.item_price_id ?? undefined,
    sizeNameSnapshot: raw.size_name_snapshot ?? undefined,
    quantity: raw.quantity ?? 0,
    unitPrice: raw.unit_price ?? 0,
    subtotal: raw.subtotal ?? 0,
    toppingTotal: raw.topping_total ?? 0,
    totalPrice: raw.total_price ?? 0,
    toppings: (raw.order_detail_toppings ?? []).map((t: RawOrderDetailTopping) => ({
      toppingId: t.topping_id ?? '',
      toppingNameSnapshot: t.topping_name_snapshot || t.topping?.name || '',
      quantity: t.quantity ?? 0,
      priceAtTime: t.price_at_time ?? 0,
      subtotal: t.subtotal ?? 0,
    })),
    note: raw.note ?? undefined,
  };
}

function mapOrder(raw: RawOrder): Order {
  return {
    id: raw.id ?? raw._id ?? '',
    code: raw.code ?? '',
    tableId: raw.table_id ?? '',
    tableName: raw.table?.name ?? '',
    items: (raw.order_details ?? []).map(mapOrderItem),
    subtotal: raw.subtotal ?? 0,
    discountAmount: raw.discount_amount ?? 0,
    totalAmount: raw.total_amount ?? 0,
    status: raw.status === 'paid' ? 'paid' : (raw.status === 'cancelled' ? 'cancelled' : 'active'),
    paymentStatus: raw.status === 'paid' ? 'paid' : 'unpaid',
    paymentMethod: (raw.payment_method as Order['paymentMethod']) ?? undefined,
    note: raw.note ?? undefined,
    createdAt: raw.created_at ?? '',
    paidAt: raw.paid_at ?? undefined,
  };
}

/**
 * Đã bỏ bảng invoices — "hóa đơn" nay là VIEW của một order đã thanh toán.
 * mapInvoice nhận thẳng raw order (có invoice_code + field thanh toán + order_details).
 * Dòng món lấy từ order_details qua mapOrderItem (đã gồm topping snapshot).
 * Thông tin quán cho phiếu in do trang tự điền từ quán đang chọn (không snapshot).
 */
function mapInvoice(raw: RawOrder): Invoice {
  const items: OrderItem[] = (raw.order_details ?? []).map(mapOrderItem);

  return {
    id: raw.id ?? raw._id ?? '',
    invoiceCode: raw.invoice_code ?? raw.code ?? '',
    orderId: raw.id ?? raw._id ?? '',
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
    // Hóa đơn luôn có phương thức; bản ghi hỏng thì ghi 'cash' còn hơn để trống
    // rồi in ra một dòng "Phương thức: undefined".
    paymentMethod: (raw.payment_method as Invoice['paymentMethod']) ?? 'cash',
    status: 'paid',
    createdAt: raw.created_at ?? '',
    paidAt: raw.paid_at ?? '',
    cashReceived: raw.cash_received ?? undefined,
    changeAmount: raw.change_amount ?? undefined,
  };
}

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
    const items = await api.get<RawOrder[]>(`/cafes/${cafeId}/orders${orderQueryString({ status: 'active' })}`);
    return items.map(mapOrder);
  },
  list: async (query: OrderQuery = {}) => {
    const cafeId = await getCafeId();
    const items = await api.get<RawOrder[]>(`/cafes/${cafeId}/orders${orderQueryString(query)}`);
    return items.map(mapOrder);
  },
  getById: async (id: string) => {
    const cafeId = await getCafeId();
    const raw = await api.get<RawOrder>(`/cafes/${cafeId}/orders/${id}`);
    return mapOrder(raw);
  },
  create: async (data: Partial<Order>) => {
    const cafeId = await getCafeId();
    const raw = await api.post<RawOrder>(`/cafes/${cafeId}/orders`, orderBody(data));
    return mapOrder(raw);
  },
  pay: async (orderId: string, data: { payment_method: string; discount_amount?: number; cash_received?: number }) => {
    const cafeId = await getCafeId();
    const raw = await api.post<RawOrder>(`/cafes/${cafeId}/orders/${orderId}/pay`, data);
    return raw;
  },
  // Hủy order đang phục vụ -> đánh dấu 'cancelled' và trả bàn về trống.
  cancel: async (orderId: string) => {
    const cafeId = await getCafeId();
    const raw = await api.post<RawOrder>(`/cafes/${cafeId}/orders/${orderId}/cancel`, {});
    return mapOrder(raw);
  },
  update: async (id: string, data: Partial<Order>) => {
    const cafeId = await getCafeId();
    const raw = await api.put<RawOrder>(`/cafes/${cafeId}/orders/${id}`, orderBody(data));
    return mapOrder(raw);
  },
};

// "Hóa đơn" = order đã thanh toán (bảng invoices đã bị bỏ, order tự mang thanh toán).
export const invoiceService = {
  // status=paid lọc ở CSDL. Trước đây tải mọi đơn (kể cả đang phục vụ và đã hủy)
  // rồi mới `.filter(o => o.status === 'paid')` trong trình duyệt.
  list: async (query: Omit<OrderQuery, 'status'> = {}) => {
    const cafeId = await getCafeId();
    const orders = await api.get<RawOrder[]>(`/cafes/${cafeId}/orders${orderQueryString({ ...query, status: 'paid' })}`);
    return orders.map(mapInvoice);
  },
  /**
   * Hóa đơn của MỘT quán chỉ định (không phụ thuộc quán đang chọn).
   * Trang doanh thu dùng hàm này để gộp số liệu nhiều quán: /revenue/overview chỉ
   * trả về tổng và số theo tháng nên không đủ để lọc theo ngày hay tính top món.
   */
  listByCafe: async (cafeId: string, cafeName?: string, query: Omit<OrderQuery, 'status'> = {}) => {
    const orders = await api.get<RawOrder[]>(`/cafes/${cafeId}/orders${orderQueryString({ ...query, status: 'paid' })}`);
    return orders
      .map(mapInvoice)
      .map((inv) => ({ ...inv, cafeId, cafeName }));
  },
  getById: async (id: string) => {
    const cafeId = await getCafeId();
    const raw = await api.get<RawOrder>(`/cafes/${cafeId}/orders/${id}`);
    return mapInvoice(raw);
  },
};
