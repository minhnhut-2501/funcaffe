import { describe, it, expect } from 'vitest';
import { calcItemBase, calcItemTopping, calcCartItem, calcSubtotal, clampDiscount, calcTotal, calcChange, isSameCartLine, type CartItem } from './cart';
import type { Product, ProductSize, Topping } from '@/types';

const mon = (basePrice: number, ten = 'Cà phê sữa'): Product => ({
  id: 'i1', name: ten, basePrice, categoryId: 'c1',
  hasSize: false, sizes: [], hasTopping: true, allowedToppingIds: [], isAvailable: true,
});
const size = (price: number, name = 'L'): ProductSize => ({ id: 's1', name, price, isActive: true });
const topping = (price: number, name = 'Trân châu'): Topping => ({ id: 't1', name, price, isAvailable: true });

const dong = (patch: Partial<CartItem> = {}): CartItem => ({
  id: 'ci1', item: mon(30_000), quantity: 1, toppings: [], note: '', ...patch,
});

describe('tiền món', () => {
  it('nhân giá gốc với số lượng', () => {
    expect(calcItemBase(dong({ quantity: 3 }))).toBe(90_000);
  });

  it('có size thì giá theo size THẮNG giá gốc', () => {
    expect(calcItemBase(dong({ size: size(45_000), quantity: 2 }))).toBe(90_000);
  });

  it('giá 0 và số lượng 0 không làm hỏng phép tính', () => {
    expect(calcItemBase(dong({ item: mon(0) }))).toBe(0);
    expect(calcItemBase(dong({ quantity: 0 }))).toBe(0);
  });
});

describe('tiền topping', () => {
  it('nhân cả theo số phần topping LẪN số lượng món', () => {
    // 2 ly, mỗi ly 1 phần trân châu 10k -> 20k, không phải 10k.
    const c = dong({ quantity: 2, toppings: [{ topping: topping(10_000), quantity: 1 }] });
    expect(calcItemTopping(c)).toBe(20_000);
  });

  it('nhiều phần của cùng một topping', () => {
    const c = dong({ quantity: 1, toppings: [{ topping: topping(10_000), quantity: 3 }] });
    expect(calcItemTopping(c)).toBe(30_000);
  });

  it('cộng dồn nhiều loại topping', () => {
    const c = dong({
      quantity: 2,
      toppings: [
        { topping: topping(10_000, 'Trân châu'), quantity: 1 },
        { topping: topping(6_000, 'Thạch dừa'), quantity: 2 },
      ],
    });
    // (10.000 + 12.000) * 2 ly
    expect(calcItemTopping(c)).toBe(44_000);
  });

  it('topping giá 0 vẫn cộng đúng bằng 0', () => {
    expect(calcItemTopping(dong({ toppings: [{ topping: topping(0), quantity: 2 }] }))).toBe(0);
  });

  it('không có topping thì bằng 0', () => {
    expect(calcItemTopping(dong())).toBe(0);
  });
});

describe('tiền một dòng và cả giỏ', () => {
  it('một dòng = tiền món + tiền topping', () => {
    const c = dong({ size: size(45_000), quantity: 2, toppings: [{ topping: topping(10_000), quantity: 1 }] });
    expect(calcCartItem(c)).toBe(90_000 + 20_000);
  });

  it('giỏ rỗng bằng 0', () => {
    expect(calcSubtotal([])).toBe(0);
    expect(calcTotal([])).toBe(0);
  });

  it('cộng đúng nhiều dòng', () => {
    const cart = [
      dong({ id: 'a', quantity: 2 }),                                        // 60.000
      dong({ id: 'b', item: mon(25_000, 'Trà đào'), quantity: 1,
             toppings: [{ topping: topping(6_000), quantity: 2 }] }),        // 25.000 + 12.000
    ];
    expect(calcSubtotal(cart)).toBe(97_000);
  });
});

describe('giảm giá', () => {
  const cart = [dong({ quantity: 2 })]; // 60.000

  it('trừ đúng số hợp lệ', () => {
    expect(calcTotal(cart, 10_000)).toBe(50_000);
  });

  it('giảm quá tạm tính thì kẹp lại, hóa đơn KHÔNG âm', () => {
    expect(calcTotal(cart, 999_000)).toBe(0);
    expect(clampDiscount(999_000, 60_000)).toBe(60_000);
  });

  it('giảm số âm bị bỏ qua, không thành cộng tiền', () => {
    expect(calcTotal(cart, -50_000)).toBe(60_000);
    expect(clampDiscount(-1, 60_000)).toBe(0);
  });

  it('giá trị hỏng (NaN) coi như không giảm', () => {
    expect(clampDiscount(NaN, 60_000)).toBe(0);
    expect(calcTotal(cart, NaN)).toBe(60_000);
  });

  it('giỏ rỗng thì không giảm được gì', () => {
    expect(clampDiscount(50_000, 0)).toBe(0);
  });
});

describe('cộng dồn hay tách dòng', () => {
  const tc = (price: number, id: string, name: string) => ({ id, name, price, isAvailable: true });

  it('hai dòng giống hệt thì cộng dồn', () => {
    expect(isSameCartLine(dong(), dong({ id: 'ci2' }))).toBe(true);
  });

  it('khác món thì tách', () => {
    expect(isSameCartLine(dong(), dong({ item: { ...mon(30_000), id: 'i2' } }))).toBe(false);
  });

  it('khác size thì tách — cùng tên món nhưng ly L không phải ly M', () => {
    expect(isSameCartLine(dong({ size: size(45_000, 'L') }), dong({ size: { ...size(35_000, 'M'), id: 's2' } }))).toBe(false);
  });

  it('món có size với món không chọn size là hai dòng khác nhau', () => {
    expect(isSameCartLine(dong({ size: size(45_000) }), dong())).toBe(false);
  });

  it('khác ghi chú thì tách — pha chế cần thấy ly "ít đường" riêng', () => {
    expect(isSameCartLine(dong({ note: 'ít đường' }), dong({ note: '' }))).toBe(false);
  });

  it('ghi chú chỉ khác khoảng trắng thừa vẫn là một dòng', () => {
    expect(isSameCartLine(dong({ note: ' ít đá ' }), dong({ note: 'ít đá' }))).toBe(true);
  });

  it('cùng bộ topping nhưng chọn khác thứ tự vẫn cộng dồn', () => {
    const a = dong({ toppings: [{ topping: tc(10_000, 't1', 'Trân châu'), quantity: 1 }, { topping: tc(6_000, 't2', 'Thạch'), quantity: 2 }] });
    const b = dong({ id: 'ci2', toppings: [{ topping: tc(6_000, 't2', 'Thạch'), quantity: 2 }, { topping: tc(10_000, 't1', 'Trân châu'), quantity: 1 }] });
    expect(isSameCartLine(a, b)).toBe(true);
  });

  it('cùng topping nhưng KHÁC SỐ PHẦN thì tách', () => {
    const a = dong({ toppings: [{ topping: tc(10_000, 't1', 'Trân châu'), quantity: 1 }] });
    const b = dong({ id: 'ci2', toppings: [{ topping: tc(10_000, 't1', 'Trân châu'), quantity: 2 }] });
    expect(isSameCartLine(a, b)).toBe(false);
  });

  it('có topping với không topping thì tách', () => {
    expect(isSameCartLine(dong({ toppings: [{ topping: tc(10_000, 't1', 'Trân châu'), quantity: 1 }] }), dong())).toBe(false);
  });
});

describe('tiền thối', () => {
  it('tính đúng phần dư', () => {
    expect(calcChange(100_000, 73_000)).toBe(27_000);
  });

  it('đưa vừa đủ thì thối 0', () => {
    expect(calcChange(73_000, 73_000)).toBe(0);
  });

  it('đưa thiếu thì trả 0 chứ KHÔNG trả số âm', () => {
    // Thu ngân đọc "-15.000" rồi đưa nhầm là chuyện có thật.
    expect(calcChange(58_000, 73_000)).toBe(0);
  });

  it('chưa nhập tiền thì thối 0', () => {
    expect(calcChange(NaN, 73_000)).toBe(0);
  });
});
