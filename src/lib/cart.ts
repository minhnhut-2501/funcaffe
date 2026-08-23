import type { Product, ProductSize, Topping } from '@/types';

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
  item: Product;
  size?: ProductSize;
  quantity: number;
  toppings: { topping: Topping; quantity: number }[];
  note: string;
}

/**
 * Hai dòng giỏ hàng có phải CÙNG MỘT THỨ không — dùng để quyết định gọi thêm một ly
 * nữa thì cộng dồn số lượng hay tách thành dòng mới.
 *
 * Cùng một thứ nghĩa là: cùng món, cùng size, cùng ghi chú, và cùng bộ topping với
 * cùng số phần. Lệch bất kỳ điểm nào cũng phải tách dòng — hai ly cùng tên nhưng một
 * ly "ít đường" thì pha chế cần thấy hai dòng riêng, gộp lại là làm sai đồ cho khách.
 *
 * Ghi chú so sánh sau khi bỏ khoảng trắng thừa; topping so sánh không phụ thuộc thứ
 * tự chọn (chọn trân châu trước hay thạch dừa trước vẫn là một ly như nhau).
 */
export function isSameCartLine(a: CartItem, b: CartItem): boolean {
  if (a.item.id !== b.item.id) return false;
  if ((a.size?.id ?? '') !== (b.size?.id ?? '')) return false;
  if ((a.note ?? '').trim() !== (b.note ?? '').trim()) return false;
  if (a.toppings.length !== b.toppings.length) return false;
  const norm = (list: CartItem['toppings']) =>
    list.map(t => `${t.topping.id}:${t.quantity}`).sort().join('|');
  return norm(a.toppings) === norm(b.toppings);
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
