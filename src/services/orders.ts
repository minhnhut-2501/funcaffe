/** Đơn hàng tại quầy và hóa đơn (hóa đơn = view của đơn đã thanh toán). */
import type { Invoice, Order, OrderItem } from '@/types';
import { api } from '@/lib/api-client';
import type { RawOrder, RawOrderDetail, RawOrderDetailTopping } from './raw';
import { getShopId } from './shop-id';

function mapOrderItem(raw: RawOrderDetail): OrderItem {
  return {
    id: raw.id ?? raw._id ?? '',
    productId: raw.product_id ?? '',
    productNameSnapshot: raw.product_name_snapshot ?? '',
    sizeId: raw.product_size_id ?? undefined,
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
    // Đơn cũ (có trước khi bán mang về) không mang trường này — coi là tại quán.
    orderType: raw.order_type === 'takeaway' ? 'takeaway' : 'dine_in',
    items: (raw.order_details ?? []).map(mapOrderItem),
    subtotal: raw.subtotal ?? 0,
    discountAmount: raw.discount_amount ?? 0,
    totalAmount: raw.total_amount ?? 0,
    status: raw.status === 'paid' ? 'paid' : (raw.status === 'cancelled' ? 'cancelled' : 'active'),
    paymentStatus: raw.status === 'paid' ? 'paid' : 'unpaid',
    paymentMethod: (raw.payment_method as Order['paymentMethod']) ?? undefined,
    invoiceCode: raw.invoice_code ?? undefined,
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
    shopId: raw.shop_id ?? undefined,
    tableId: raw.table_id ?? undefined,
    orderCode: raw.code ?? '',
    tableName: raw.table?.name ?? '',
    orderType: raw.order_type === 'takeaway' ? 'takeaway' : 'dine_in',
    shopName: undefined,
    shopAddress: undefined,
    shopPhone: undefined,
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
 * Bộ lọc cho `GET /shops/{shop}/orders`.
 * Luôn truyền ít nhất `status`: không truyền gì là kéo về TOÀN BỘ lịch sử bán hàng
 * của quán kèm dòng món và topping.
 */
export interface OrderQuery {
  status?: 'active' | 'paid' | 'cancelled';
  from?: string;  // 'YYYY-MM-DD'
  to?: string;    // 'YYYY-MM-DD'
  limit?: number;
  /** Bỏ dòng món và topping khỏi phản hồi. Chỉ dùng khi nơi gọi thật sự không cần chúng. */
  slim?: boolean;
}

function orderQueryString(q: OrderQuery): string {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.limit) params.set('limit', String(q.limit));
  if (q.slim) params.set('slim', '1');
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
    // Gửi TƯỜNG MINH kể cả khi là 'dine_in': backend đặt mặc định rồi mới validate,
    // nhưng để client nói rõ ý mình vẫn hơn là dựa vào mặc định của phía kia.
    order_type: data.orderType ?? 'dine_in',
    // Đơn mang về không có bàn -> gửi null chứ không gửi chuỗi rỗng.
    table_id: data.tableId || null,
    note: data.note,
    discount_amount: data.discountAmount,
    items: (data.items ?? []).map((item) => ({
      product_id: item.productId,
      product_name_snapshot: item.productNameSnapshot,
      quantity: item.quantity,
      product_size_id: item.sizeId,
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
    const shopId = await getShopId();
    const items = await api.get<RawOrder[]>(`/shops/${shopId}/orders${orderQueryString({ status: 'active' })}`);
    return items.map(mapOrder);
  },
  list: async (query: OrderQuery = {}) => {
    const shopId = await getShopId();
    const items = await api.get<RawOrder[]>(`/shops/${shopId}/orders${orderQueryString(query)}`);
    return items.map(mapOrder);
  },
  getById: async (id: string) => {
    const shopId = await getShopId();
    const raw = await api.get<RawOrder>(`/shops/${shopId}/orders/${id}`);
    return mapOrder(raw);
  },
  create: async (data: Partial<Order>) => {
    const shopId = await getShopId();
    const raw = await api.post<RawOrder>(`/shops/${shopId}/orders`, orderBody(data));
    return mapOrder(raw);
  },
  /**
   * Bán MANG VỀ: tạo đơn và thu tiền trong MỘT lượt gọi.
   *
   * Máy chủ kiểm tiền khách đưa TRƯỚC khi tạo đơn, nên đưa thiếu là 422 bay về lúc
   * cơ sở dữ liệu còn chưa có gì — không có đơn nào nằm lại. Đó là lý do gộp một
   * lượt thay vì gọi create() rồi pay(): lượt thứ hai hỏng sẽ để lại đơn `active`
   * không gắn bàn, mà màn hình Bán hàng dẫn xuất mọi thứ theo bàn nên đơn đó không
   * hiện ở đâu để ai đó thu tiền hay hủy đi.
   *
   * Trả về RAW để nơi gọi đọc thẳng `invoice_code` / `change_amount` — hai trường
   * này không có trong kiểu `Order` của giao diện.
   */
  taoVaThanhToanMangVe: async (data: {
    items: OrderItem[];
    subtotal: number;
    totalAmount: number;
    payment_method: string;
    cash_received?: number;
  }) => {
    const shopId = await getShopId();
    return api.post<RawOrder>(`/shops/${shopId}/orders`, {
      ...orderBody({
        orderType: 'takeaway',
        items: data.items,
        subtotal: data.subtotal,
        totalAmount: data.totalAmount,
      }),
      payment_method: data.payment_method,
      ...(data.cash_received !== undefined ? { cash_received: data.cash_received } : {}),
    });
  },
  /**
   * Xin liên kết thanh toán VNPay cho một đơn đang phục vụ.
   *
   * Trả về `pay_url` để màn Bán hàng vẽ thành mã QR. Đơn KHÔNG được chốt ở đây —
   * nó chỉ chốt khi VNPay gọi ngược về IPN (đường server-to-server có chữ ký), nên
   * sau khi hiện QR thì giao diện phải hỏi lại trạng thái đơn cho tới lúc thấy 'paid'.
   */
  xinLienKetVnpay: async (orderId: string) => {
    const shopId = await getShopId();
    return api.post<{ pay_url: string; txn_ref: string; amount: number; order_id: string }>(
      `/shops/${shopId}/orders/${orderId}/vnpay`, {},
    );
  },
  /** Trạng thái hiện tại của một đơn — dùng để hỏi lại trong lúc chờ khách quét mã. */
  trangThai: async (orderId: string) => {
    const shopId = await getShopId();
    const raw = await api.get<RawOrder>(`/shops/${shopId}/orders/${orderId}`);
    return mapOrder(raw);
  },
  pay: async (orderId: string, data: { payment_method: string; discount_amount?: number; cash_received?: number }) => {
    const shopId = await getShopId();
    const raw = await api.post<RawOrder>(`/shops/${shopId}/orders/${orderId}/pay`, data);
    return raw;
  },
  // Hủy order đang phục vụ -> đánh dấu 'cancelled' và trả bàn về trống.
  cancel: async (orderId: string) => {
    const shopId = await getShopId();
    const raw = await api.post<RawOrder>(`/shops/${shopId}/orders/${orderId}/cancel`, {});
    return mapOrder(raw);
  },
  update: async (id: string, data: Partial<Order>) => {
    const shopId = await getShopId();
    const raw = await api.put<RawOrder>(`/shops/${shopId}/orders/${id}`, orderBody(data));
    return mapOrder(raw);
  },
};

// "Hóa đơn" = order đã thanh toán (bảng invoices đã bị bỏ, order tự mang thanh toán).
export const invoiceService = {
  // status=paid lọc ở CSDL. Trước đây tải mọi đơn (kể cả đang phục vụ và đã hủy)
  // rồi mới `.filter(o => o.status === 'paid')` trong trình duyệt.
  /**
   * Danh sách cho BẢNG hóa đơn — không kèm dòng món.
   *
   * Bảng đó chỉ hiện mã, bàn, tổng tiền, phương thức, giờ. Kéo về chi tiết của hàng
   * trăm hóa đơn để vẽ một cái bảng không dùng tới chi tiết là phần nặng nhất của
   * lượt gọi nặng nhất ứng dụng. `items` trả về rỗng — nơi nào cần chi tiết thì gọi
   * `getById`, và trang Hóa đơn làm đúng vậy lúc mở một tờ ra xem hoặc in.
   *
   * Nhờ vậy vẫn giữ được tính chất đáng giá nhất của trang: tìm kiếm và lọc chạy trên
   * TOÀN BỘ lịch sử ngay tại trình duyệt, không phải hỏi lại máy chủ mỗi lần gõ phím.
   */
  list: async (query: Omit<OrderQuery, 'status'> = {}) => {
    const shopId = await getShopId();
    const orders = await api.get<RawOrder[]>(`/shops/${shopId}/orders${orderQueryString({ ...query, status: 'paid', slim: true })}`);
    return orders.map(mapInvoice);
  },
  /**
   * Hóa đơn của MỘT quán chỉ định (không phụ thuộc quán đang chọn).
   * Trang doanh thu dùng hàm này để gộp số liệu nhiều quán: /revenue/overview chỉ
   * trả về tổng và số theo tháng nên không đủ để lọc theo ngày hay tính top món.
   */
  listByShop: async (shopId: string, shopName?: string, query: Omit<OrderQuery, 'status'> = {}) => {
    // getList chứ không phải get: đây là lượt gọi NẶNG NHẤT của cả ứng dụng (toàn bộ
    // hóa đơn của một quán kèm dòng món và topping) và là lượt duy nhất từng chạm
    // hạn chờ mặc định. Xem LIST_TIMEOUT_MS trong api-client.
    const orders = await api.getList<RawOrder[]>(`/shops/${shopId}/orders${orderQueryString({ ...query, status: 'paid' })}`);
    return orders
      .map(mapInvoice)
      .map((inv) => ({ ...inv, shopId, shopName }));
  },
  getById: async (id: string) => {
    const shopId = await getShopId();
    const raw = await api.get<RawOrder>(`/shops/${shopId}/orders/${id}`);
    return mapInvoice(raw);
  },
};
