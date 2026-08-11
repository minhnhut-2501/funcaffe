/**
 * Hình dạng JSON máy chủ trả về, cho ĐƯỜNG ĐI CỦA TIỀN (món, đơn, hóa đơn).
 *
 * Vì sao cần: các hàm `map*` trước đây nhận `raw: any`, nên gõ nhầm tên trường
 * (`base_prce`, `total_amout`) không hề báo lỗi — chỉ lặng lẽ cho ra `undefined`
 * rồi thành `0` hoặc `NaN` trên hóa đơn. Khai đúng tên trường ở đây là chốt chặn
 * duy nhất bắt được lỗi đó lúc biên dịch.
 *
 * Mọi trường đều để tùy chọn: bản ghi cũ trong MongoDB thiếu trường là chuyện
 * bình thường, và chính vì vậy mapper phải luôn có giá trị dự phòng.
 */

/** Mongo trả `id` khi đi qua model Laravel, `_id` khi đọc thô. */
export interface RawId {
  id?: string;
  _id?: string;
}

export interface RawItemPrice extends RawId {
  size_name?: string;
  /** Bản ghi rất cũ còn nhúng cả object size. */
  size?: { name?: string };
  price?: number;
  is_active?: boolean;
}

export interface RawItemTopping {
  topping_id?: string;
}

export interface RawItem extends RawId {
  name?: string;
  base_price?: number;
  category_id?: string;
  image?: string;
  description?: string;
  has_size?: boolean;
  item_prices?: RawItemPrice[];
  allow_topping?: boolean;
  item_toppings?: RawItemTopping[];
  is_available?: boolean;
}

export interface RawTopping extends RawId {
  name?: string;
  price?: number;
  image?: string;
  is_available?: boolean;
}

export interface RawCategory extends RawId {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface RawOrderDetailTopping {
  topping_id?: string;
  topping_name_snapshot?: string;
  topping?: { name?: string };
  quantity?: number;
  price_at_time?: number;
  subtotal?: number;
}

export interface RawOrderDetail extends RawId {
  item_id?: string;
  item_name_snapshot?: string;
  item_price_id?: string;
  size_name_snapshot?: string;
  quantity?: number;
  unit_price?: number;
  subtotal?: number;
  topping_total?: number;
  total_price?: number;
  order_detail_toppings?: RawOrderDetailTopping[];
  note?: string;
}

export interface RawOrder extends RawId {
  code?: string;
  cafe_id?: string;
  table_id?: string;
  table?: { name?: string };
  order_details?: RawOrderDetail[];
  subtotal?: number;
  discount_amount?: number;
  total_amount?: number;
  status?: string;
  payment_method?: string;
  note?: string;
  created_at?: string;
  paid_at?: string;
  /** Chỉ có ở đơn đã thanh toán — hóa đơn là VIEW của đơn đã thanh toán. */
  invoice_code?: string;
  cash_received?: number;
  change_amount?: number;
}

export interface RawTable extends RawId {
  name?: string;
  capacity?: number;
  status?: string;
  current_order_id?: string;
}
