import type { MenuItem, MenuItemSize, Topping } from '@/types';

/**
 * Phép tính tiền của giỏ hàng tại quầy.
 *
 * Tách khỏi màn hình Bán hàng (1.096 dòng) vì đây là chỗ tiền thật đổi chủ mỗi
 * ngày, mà nằm lẫn trong component thì không có cách nào kiểm bằng bài kiểm thử.
 *
 * CÔNG THỨC PHẢI KHỚP BACKEND (`OrderController`):
 *   tiền một dòng = (giá theo size × số lượng) + (Σ giá topping × số phần) × số lượng
 *   tổng đơn      = Σ tiền các dòng − giảm giá (kẹp trong [0, tạm tính])
 *
 * Máy chủ vẫn tính lại toàn bộ từ CSDL và KHÔNG tin số client gửi lên; các hàm ở
 * đây chỉ để màn hình hiện đúng con số mà máy chủ sẽ chốt.
 */

export interface CartItem {
  id: string;
  item: MenuItem;
  size?: MenuItemSize;
  quantity: number;
  toppings: { topping: Topping; quantity: number }[];
  note: string;
}

/** Tiền món (chưa topping). Có size thì giá theo size THẮNG giá gốc của món. */
export function calcItemBase(c: CartItem): number {
  return (c.size ? c.size.price : c.item.basePrice) * c.quantity;
}

/**
 * Tiền topping của một dòng.
 *
 * Nhân với `c.quantity` ở ngoài: gọi 2 ly cà phê, mỗi ly 1 phần trân châu thì
 * phải tính 2 phần trân châu. Quên phép nhân này là quán thu thiếu mỗi ngày một ít
 * mà không ai để ý.
 */
export function calcItemTopping(c: CartItem): number {
  return c.toppings.reduce((s, t) => s + t.topping.price * t.quantity, 0) * c.quantity;
}

/** Tiền của một dòng trong giỏ, gồm cả topping. */
export function calcCartItem(c: CartItem): number {
  return calcItemBase(c) + calcItemTopping(c);
}

/** Tạm tính cả giỏ, chưa trừ giảm giá. */
export function calcSubtotal(cart: CartItem[]): number {
  return cart.reduce((s, c) => s + calcCartItem(c), 0);
}

/**
 * Kẹp giảm giá trong [0, tạm tính]: giảm quá tạm tính là hóa đơn ÂM, giảm số âm
 * là cộng thêm tiền của khách. Backend kẹp lại lần nữa — đây chỉ để màn hình khớp.
 */
export function clampDiscount(input: number, subtotal: number): number {
  if (!Number.isFinite(input)) return 0;
  return Math.min(Math.max(0, input), Math.max(0, subtotal));
}

/** Tổng phải thu. */
export function calcTotal(cart: CartItem[], discountInput = 0): number {
  const subtotal = calcSubtotal(cart);
  return subtotal - clampDiscount(discountInput, subtotal);
}

/**
 * Tiền thối. Khách đưa thiếu thì trả 0 chứ không trả số âm — thu ngân đọc "-15.000"
 * rồi đưa nhầm là chuyện có thật. Việc CHẶN thanh toán khi thiếu tiền do nơi gọi lo.
 */
export function calcChange(cashGiven: number, total: number): number {
  if (!Number.isFinite(cashGiven) || !Number.isFinite(total)) return 0;
  return Math.max(0, cashGiven - total);
}
