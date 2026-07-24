'use client';
import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/format';
import { generateId } from '@/lib/utils';
import { tableService, menuService, categoryService, toppingService, orderService, cafeService } from '@/services';
import type { CafeTable, MenuItem, MenuItemSize, Topping, Order, OrderItem, CafeInfo } from '@/types';
import { buildVietQrImageUrl } from '@/lib/banks';
import Link from 'next/link';
import { Plus, Minus, X, CreditCard, AlertCircle, CheckCircle2, ShoppingCart, Receipt, Banknote } from 'lucide-react';
import { VietQrMark } from '@/components/ui/PaymentLogos';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import TableTile from '@/components/user/TableTile';
import MenuCard from '@/components/user/MenuCard';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { canManage } from '@/lib/permission';

interface CartItem {
  id: string;
  item: MenuItem;
  size?: MenuItemSize;
  quantity: number;
  toppings: { topping: Topping; quantity: number }[];
  note: string;
}

function calcItemBase(c: CartItem): number {
  return (c.size ? c.size.price : c.item.basePrice) * c.quantity;
}

function calcItemTopping(c: CartItem): number {
  return c.toppings.reduce((s, t) => s + t.topping.price * t.quantity, 0) * c.quantity;
}

function calcCartItem(c: CartItem): number {
  return calcItemBase(c) + calcItemTopping(c);
}

// Hai dòng giỏ được coi là trùng khi cùng món, cùng size, cùng ghi chú và cùng topping (id + số lượng)
function isSameCartLine(a: CartItem, b: CartItem): boolean {
  if (a.item.id !== b.item.id) return false;
  if ((a.size?.id ?? '') !== (b.size?.id ?? '')) return false;
  if ((a.note ?? '').trim() !== (b.note ?? '').trim()) return false;
  if (a.toppings.length !== b.toppings.length) return false;
  const norm = (list: CartItem['toppings']) =>
    list.map(t => `${t.topping.id}:${t.quantity}`).sort().join('|');
  return norm(a.toppings) === norm(b.toppings);
}

const tableStatusFilter = [
  { value: 'all', label: 'Tất cả' },
  { value: 'empty', label: 'Trống' },
  { value: 'serving', label: 'Đang phục vụ' },
];

export default function SalesPage() {
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof categoryService.list>>>([]);
  const [allToppings, setAllToppings] = useState<Topping[]>([]);
  const [selectedTable, setSelectedTable] = useState<CafeTable | null>(null);
  const [tableFilter, setTableFilter] = useState('all');
  const [carts, setCarts] = useState<Record<string, CartItem[]>>({});
  const [catFilter, setCatFilter] = useState('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [optionModal, setOptionModal] = useState<{ item: MenuItem } | null>(null);
  const [editCartItemId, setEditCartItemId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [successModal, setSuccessModal] = useState<{ code: string; total: number; method: string; cashGiven?: number; change?: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashGiven, setCashGiven] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const managable = canManage(user?.subscription);
  const [loading, setLoading] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [draftOrderIds, setDraftOrderIds] = useState<Record<string, string>>({});
  const [cafeInfo, setCafeInfo] = useState<CafeInfo | null>(null);

  const cartToOrderItems = (items: CartItem[]): OrderItem[] =>
    items.map(c => ({
      id: c.id,
      itemId: c.item.id,
      itemNameSnapshot: c.item.name,
      sizeId: c.size?.id,
      sizeNameSnapshot: c.size?.name,
      quantity: c.quantity,
      unitPrice: c.size ? c.size.price : c.item.basePrice,
      subtotal: calcCartItem(c),
      toppings: c.toppings.map(t => ({
        toppingId: t.topping.id,
        toppingNameSnapshot: t.topping.name,
        quantity: t.quantity,
        priceAtTime: t.topping.price,
        subtotal: t.topping.price * t.quantity * c.quantity,
      })),
      note: c.note,
    }));

  const [optForm, setOptForm] = useState<{
    size: MenuItemSize | null;
    toppings: { toppingId: string; qty: number }[];
    qty: number;
    note: string;
  }>({ size: null, toppings: [], qty: 1, note: '' });

  const cart = selectedTable ? carts[selectedTable.id] ?? [] : [];

  const setCart = (updater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    if (!selectedTable) return;
    setCarts(prev => {
      const current = prev[selectedTable.id] ?? [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next.length === 0) {
        const { [selectedTable.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [selectedTable.id]: next };
    });
  };

  const clearCartForTable = (tableId: string) => {
    setCarts(prev => {
      const { [tableId]: _, ...rest } = prev;
      return rest;
    });
  };

  const showToast = (msg: string) => toast({ description: msg });

  useEffect(() => {
    cafeService.get().then(setCafeInfo).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      tableService.list().then(setTables),
      categoryService.list().then(setCategories),
      toppingService.list().then(setAllToppings),
      // Thực đơn phải về CÙNG LÚC với order: order chỉ lưu snapshot tên/giá,
      // muốn có ảnh món cho phiếu order thì phải tra ngược từ thực đơn theo itemId.
      Promise.all([menuService.list(), orderService.list()]).then(([menu, allOrders]) => {
        setMenuItems(menu);
        const menuById = new Map(menu.map(m => [m.id, m]));
        const active = allOrders.filter(o => o.status === 'active');
        setActiveOrders(active);
        const draftMap: Record<string, string> = {};
        const cartsFromOrders: Record<string, CartItem[]> = {};
        for (const order of active) {
          draftMap[order.tableId] = order.id;
          cartsFromOrders[order.tableId] = order.items.map(oi => ({
            id: oi.id,
            item: {
              id: oi.itemId,
              name: oi.itemNameSnapshot,
              basePrice: oi.unitPrice,
              categoryId: menuById.get(oi.itemId)?.categoryId ?? '',
              imageUrl: menuById.get(oi.itemId)?.imageUrl,
              description: undefined,
              hasSize: !!oi.sizeId,
              sizes: oi.sizeId ? [{ id: oi.sizeId, name: oi.sizeNameSnapshot ?? '', price: oi.unitPrice, isActive: true }] : [],
              allowTopping: false,
              allowedToppingIds: [],
              isAvailable: true,
            },
            size: oi.sizeId ? { id: oi.sizeId, name: oi.sizeNameSnapshot ?? '', price: oi.unitPrice, isActive: true } : undefined,
            quantity: oi.quantity,
            toppings: oi.toppings.map(t => ({
              topping: { id: t.toppingId, name: t.toppingNameSnapshot, price: t.priceAtTime, isAvailable: true },
              quantity: t.quantity,
            })),
            note: oi.note ?? '',
          }));
        }
        setDraftOrderIds(draftMap);
        setCarts(cartsFromOrders);
      }),
    ]).catch(() => showToast('Không thể tải dữ liệu')).finally(() => setLoading(false));
  }, []);


  const filteredTables = tables.filter(t => tableFilter === 'all' || t.status === tableFilter);

  const filteredMenu = menuItems.filter(i =>
    i.isAvailable &&
    (catFilter === 'all' || i.categoryId === catFilter) &&
    i.name.toLowerCase().includes(menuSearch.toLowerCase())
  );

  const baseSubtotal = cart.reduce((s, c) => s + calcItemBase(c), 0);
  const toppingSubtotal = cart.reduce((s, c) => s + calcItemTopping(c), 0);
  const discount = 0;
  const cartTotal = baseSubtotal + toppingSubtotal - discount;

  const openOption = (item: MenuItem) => {
    if (!managable) {
      showToast('Gói đã hết hạn — chỉ có thể xem. Vui lòng gia hạn để bán hàng.');
      return;
    }
    if (!selectedTable) {
      showToast('Vui lòng chọn bàn trước khi thêm món.');
      return;
    }
    setEditCartItemId(null);
    setOptionModal({ item });
    setOptForm({
      size: item.hasSize && item.sizes.length > 0
        ? item.sizes.find(s => s.isActive) ?? item.sizes[0]
        : null,
      toppings: [],
      qty: 1,
      note: '',
    });
  };

  const openEditOption = (c: CartItem) => {
    setEditCartItemId(c.id);
    setOptionModal({ item: c.item });
    setOptForm({
      size: c.size ?? (c.item.hasSize && c.item.sizes.length > 0 ? c.item.sizes.find(s => s.isActive) ?? c.item.sizes[0] : null),
      toppings: c.toppings.map(t => ({ toppingId: t.topping.id, qty: t.quantity })),
      qty: c.quantity,
      note: c.note,
    });
  };

  const allowedToppings = optionModal
    ? allToppings.filter(t => t.isAvailable && optionModal.item.allowedToppingIds.includes(t.id))
    : [];

  const optTotal =
    ((optForm.size?.price ?? optionModal?.item.basePrice ?? 0) +
      optForm.toppings.reduce((s, t) => s + (allToppings.find(tp => tp.id === t.toppingId)?.price ?? 0), 0)) *
    optForm.qty;

  const handleSaveCartItem = async () => {
    if (!optionModal || !selectedTable) return;
    if (savingItem) return; // chống tạo trùng order khi bấm liên tiếp
    setSavingItem(true);
    const { item } = optionModal;
    const newItem: CartItem = {
      id: editCartItemId ?? generateId('ci'),
      item,
      size: optForm.size ?? undefined,
      quantity: optForm.qty,
      toppings: optForm.toppings
        .reduce<{ topping: Topping; quantity: number }[]>((acc, t) => {
          const topping = allToppings.find(tp => tp.id === t.toppingId);
          if (topping) acc.push({ topping, quantity: t.qty });
          return acc;
        }, []),
      note: optForm.note,
    };
    const cur = carts[selectedTable.id] ?? [];
    // Khi thêm mới, nếu đã có dòng trùng khớp hoàn toàn thì cộng dồn số lượng thay vì tách riêng
    const mergeTarget = editCartItemId ? undefined : cur.find(c => isSameCartLine(c, newItem));
    const updatedCart = editCartItemId
      ? cur.map(c => c.id === editCartItemId ? newItem : c)
      : mergeTarget
        ? cur.map(c => c.id === mergeTarget.id ? { ...c, quantity: c.quantity + newItem.quantity } : c)
        : [...cur, newItem];
    const newBaseSubtotal = updatedCart.reduce((s, c) => s + calcItemBase(c), 0);
    const newToppingSubtotal = updatedCart.reduce((s, c) => s + calcItemTopping(c), 0);
    const newTotal = newBaseSubtotal + newToppingSubtotal;
    const orderItems = cartToOrderItems(updatedCart);

    try {
      const existingId = draftOrderIds[selectedTable.id];
      if (existingId) {
        const updated = await orderService.update(existingId, {
          tableId: selectedTable.id,
          items: orderItems,
          subtotal: newBaseSubtotal,
          discountAmount: 0,
          totalAmount: newTotal,
        });
        setActiveOrders(prev => prev.map(o => o.id === existingId ? updated : o));
      } else {
        const created = await orderService.create({
          tableId: selectedTable.id,
          items: orderItems,
          subtotal: newBaseSubtotal,
          discountAmount: 0,
          totalAmount: newTotal,
          status: 'active',
          paymentStatus: 'unpaid',
          createdAt: new Date().toISOString(),
        });
        setDraftOrderIds(prev => ({ ...prev, [selectedTable.id]: created.id }));
        setActiveOrders(prev => [...prev, created]);
        // Đồng bộ trạng thái bàn sang "đang phục vụ" như backend
        setTables(prev => prev.map(t =>
          t.id === selectedTable.id ? { ...t, status: 'serving' as const, currentOrderId: created.id } : t
        ));
      }
      setCart(updatedCart);
      if (editCartItemId) setEditCartItemId(null);
      setOptionModal(null);
    } catch {
      showToast('Không thể lưu order, vui lòng thử lại');
    } finally {
      setSavingItem(false);
    }
  };

  const toggleTopping = (toppingId: string) => {
    setOptForm(f => {
      const exists = f.toppings.find(t => t.toppingId === toppingId);
      if (exists) return { ...f, toppings: f.toppings.filter(t => t.toppingId !== toppingId) };
      return { ...f, toppings: [...f.toppings, { toppingId, qty: 1 }] };
    });
  };

  const persistCart = async (tableId: string, items: CartItem[]) => {
    const bs = items.reduce((s, c) => s + calcItemBase(c), 0);
    const ts = items.reduce((s, c) => s + calcItemTopping(c), 0);
    const tot = bs + ts;
    const orderItems = cartToOrderItems(items);
    try {
      const existingId = draftOrderIds[tableId];
      if (existingId) {
        if (items.length === 0) {
          await orderService.update(existingId, {
            tableId, items: [], subtotal: 0, discountAmount: 0, totalAmount: 0,
          });
        } else {
          const updated = await orderService.update(existingId, {
            tableId, items: orderItems, subtotal: bs, discountAmount: 0, totalAmount: tot,
          });
          setActiveOrders(prev => prev.map(o => o.id === existingId ? updated : o));
        }
      } else if (items.length > 0) {
        const created = await orderService.create({
          tableId, items: orderItems, subtotal: bs, discountAmount: 0, totalAmount: tot,
          status: 'active', paymentStatus: 'unpaid', createdAt: new Date().toISOString(),
        });
        setDraftOrderIds(prev => ({ ...prev, [tableId]: created.id }));
        setActiveOrders(prev => [...prev, created]);
      }
    } catch {
      showToast('Không thể lưu thay đổi');
    }
  };

  const removeCartItem = (id: string) => {
    if (!selectedTable) return;
    setCart(prev => {
      const next = prev.filter(c => c.id !== id);
      persistCart(selectedTable.id, next);
      return next;
    });
  };

  const updateQty = (id: string, delta: number) => {
    if (!selectedTable) return;
    setCart(prev => {
      const next = prev.map(c => {
        if (c.id !== id) return c;
        const newQty = c.quantity + delta;
        return newQty <= 0 ? null : { ...c, quantity: newQty };
      }).filter(Boolean) as CartItem[];
      persistCart(selectedTable.id, next);
      return next;
    });
  };

  const [processing, setProcessing] = useState(false);

  const handleCancelOrder = async () => {
    if (cart.length === 0) {
      if (selectedTable) {
        const existingId = draftOrderIds[selectedTable.id];
        if (existingId) {
          try { await orderService.cancel(existingId); } catch {}
          setDraftOrderIds(prev => { const { [selectedTable.id]: _, ...rest } = prev; return rest; });
          setActiveOrders(prev => prev.filter(o => o.id !== existingId));
          // Hủy order -> bàn về trống
          setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'empty' as const, currentOrderId: undefined } : t));
        }
        clearCartForTable(selectedTable.id);
      }
      setSelectedTable(null);
      return;
    }
    setClearConfirm(true);
  };

  const handlePayment = async () => {
    if (!selectedTable || cart.length === 0) return;

    const cashReceived = paymentMethod === 'cash' ? Number(cashGiven.replace(/\D/g, '')) : 0;
    // Khách đưa thiếu tiền -> không cho xác nhận (backend cũng chặn 422)
    if (paymentMethod === 'cash' && cashReceived > 0 && cashReceived < cartTotal) {
      showToast(`Tiền khách đưa chưa đủ, còn thiếu ${formatCurrency(cartTotal - cashReceived)}.`);
      return;
    }

    setProcessing(true);
    try {
      const orderId = draftOrderIds[selectedTable.id];
      if (!orderId) { showToast('Không tìm thấy order, vui lòng thêm món lại'); setProcessing(false); return; }

      const payResult = await orderService.pay(orderId, {
        payment_method: paymentMethod,
        discount_amount: discount,
        ...(paymentMethod === 'cash' && cashReceived > 0 ? { cash_received: cashReceived } : {}),
      });

      // Order nay tự mang mã phiếu (invoice_code) sau khi thanh toán — bỏ bảng invoices.
      const invoiceCode = payResult?.invoice_code
        ?? payResult?.code
        ?? selectedTable.name;

      // Thanh toán xong bàn về TRỐNG (backend cũng đặt 'empty') — đồng bộ đúng trạng thái
      setTables(prev => prev.map(t =>
        t.id === selectedTable.id ? { ...t, status: 'empty' as const, currentOrderId: undefined } : t
      ));
      setDraftOrderIds(prev => { const { [selectedTable.id]: _, ...rest } = prev; return rest; });
      setActiveOrders(prev => prev.filter(o => o.id !== orderId));
      clearCartForTable(selectedTable.id);
      setSelectedTable(null);
      setPaymentModal(false);
      setCashGiven('');
      setSuccessModal({
        code: invoiceCode,
        total: cartTotal,
        method: paymentMethod,
        cashGiven: paymentMethod === 'cash' && cashReceived > 0 ? cashReceived : undefined,
        change: paymentMethod === 'cash' && cashReceived > cartTotal ? cashReceived - cartTotal : undefined,
      });
    } catch {
      showToast('Thanh toán thất bại, vui lòng thử lại');
    } finally {
      setProcessing(false);
    }
  };

  const cashChange = cashGiven
    ? Number(cashGiven.replace(/\D/g, '')) - cartTotal
    : 0;

  return (
    <div className="flex flex-col md:h-[calc(100vh-9rem)]">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl bg-bean text-white grid place-items-center shadow-soft shrink-0">
          <ShoppingCart className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Bán hàng</h1>
          <p className="text-cafe-500 text-sm">Chọn bàn, chọn món và thanh toán</p>
        </div>
      </div>

      {loading ? <div className="flex-1"><LoadingSkeleton variant="table" rows={6} cols={4} /></div> : (
      <div className="flex flex-col md:flex-row gap-3 flex-1 md:min-h-0">
        {/* Column 1: Tables */}
        <div data-shot="tables" className="h-[40vh] md:h-auto w-full md:w-[26%] shrink-0 bg-white rounded-2xl border border-line shadow-soft flex flex-col overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-line bg-sand/60 space-y-2">
            <p className="text-[11px] font-bold text-bean uppercase tracking-wider">Bàn</p>
            <select className="input-funcafe text-xs py-1.5" value={tableFilter} onChange={e => setTableFilter(e.target.value)}>
              {tableStatusFilter.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-2 gap-2 content-start">
            {filteredTables.map(t => (
              <TableTile key={t.id} table={t} selected={selectedTable?.id === t.id} onClick={() => setSelectedTable(t)} />
            ))}
            {filteredTables.length === 0 && <p className="col-span-2 text-xs text-cafe-400 text-center py-6">{tables.length === 0 ? 'Bạn chưa thêm bàn nào' : 'Không tìm thấy bàn'}</p>}
          </div>
        </div>

        {/* Column 2: Menu */}
        <div data-shot="menu" className="h-[58vh] md:h-auto w-full md:flex-1 bg-white rounded-2xl border border-line shadow-soft flex flex-col overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-line bg-sand/60 space-y-2">
            <p className="text-[11px] font-bold text-bean uppercase tracking-wider">Thực đơn</p>
            <input className="input-funcafe py-1.5 text-xs" placeholder="Tìm món..." value={menuSearch} onChange={e => setMenuSearch(e.target.value)} />
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setCatFilter('all')}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${catFilter === 'all' ? 'bg-bean text-white' : 'bg-sand text-slate hover:bg-bean-tint hover:text-bean'}`}>Tất cả</button>
              {categories.filter(cat => cat.isActive).map(cat => (
                <button key={cat.id} onClick={() => setCatFilter(cat.id)}
                  className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${catFilter === cat.id ? 'bg-bean text-white' : 'bg-sand text-slate hover:bg-bean-tint hover:text-bean'}`}>{cat.name}</button>
              ))}
            </div>
          </div>

          {!selectedTable && (
            <div className="px-3.5 py-2 bg-gold/12 border-b border-gold/20 flex items-center gap-2 text-xs text-gold-deep font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />Chọn bàn để bắt đầu thêm món
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredMenu.map(item => (
                <MenuCard key={item.id} item={item} onClick={() => openOption(item)} />
              ))}
              {filteredMenu.length === 0 && <div className="col-span-3 text-center text-cafe-300 text-sm py-12">{menuItems.length === 0 ? 'Bạn chưa thêm món nào' : 'Không tìm thấy món'}</div>}
            </div>
          </div>
        </div>

        {/* Column 3: Cart */}
        <div data-shot="cart" className="h-[58vh] md:h-auto w-full md:w-[28%] shrink-0 bg-white rounded-2xl border border-line shadow-soft flex flex-col overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-line bg-sand/60 flex items-center justify-between">
            <p className="text-[11px] font-bold text-bean uppercase tracking-wider">
              {selectedTable ? selectedTable.name : 'Order hiện tại'}
            </p>
            {selectedTable && <span className="text-[11px] text-cafe-500 font-medium">{cart.length} món</span>}
          </div>

          {!selectedTable ? (
            <div className="flex-1 flex flex-col items-center justify-center text-cafe-300 text-xs px-4 text-center gap-2">
              <ShoppingCart className="w-8 h-8 text-cafe-200" />
              Vui lòng chọn bàn để bắt đầu order.
            </div>
          ) : cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-cafe-300 text-xs gap-2">
              <ShoppingCart className="w-8 h-8 text-cafe-200" />
              Chưa có món nào
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {cart.map(c => (
                <div key={c.id} className="bg-sand/70 rounded-xl p-2.5 border border-line/60">
                  <div className="flex items-start justify-between gap-1">
                    {/* Ảnh món giúp nhân viên soát lại phiếu bằng mắt khi order nhiều dòng.
                        Dùng <span> thay <p> vì thẻ này nằm trong <button> (p không hợp lệ trong button). */}
                    <button onClick={() => openEditOption(c)} className="group flex-1 min-w-0 flex items-start gap-2 text-left cursor-pointer">
                      <span className="w-10 h-10 rounded-lg bg-white border border-line overflow-hidden shrink-0 grid place-items-center">
                        {c.item.imageUrl
                          ? <img src={c.item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                          : <span aria-hidden className="text-base text-bean/40">☕</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-ink leading-snug group-hover:text-bean">{c.item.name}</span>
                        {c.size && <span className="block text-xs text-cafe-500">Size {c.size.name} — {formatCurrency(c.size.price)}</span>}
                        {c.toppings.map(t => <span key={t.topping.id} className="block text-xs text-cafe-400">+ {t.topping.name} ({formatCurrency(t.topping.price)})</span>)}
                        {c.note && <span className="block text-xs text-cafe-400 italic mt-0.5">&ldquo;{c.note}&rdquo;</span>}
                      </span>
                    </button>
                    <button onClick={() => removeCartItem(c.id)} className="text-cafe-300 hover:text-red-500 p-0.5 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQty(c.id, -1)} className="w-6 h-6 rounded-lg bg-white border border-line grid place-items-center hover:border-bean hover:text-bean transition-colors"><Minus className="w-3 h-3" /></button>
                      <span className="text-xs font-bold w-5 text-center">{c.quantity}</span>
                      <button onClick={() => updateQty(c.id, 1)} className="w-6 h-6 rounded-lg bg-white border border-line grid place-items-center hover:border-bean hover:text-bean transition-colors"><Plus className="w-3 h-3" /></button>
                    </div>
                    <span className="text-xs font-bold text-bean">{formatCurrency(calcCartItem(c))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedTable && cart.length > 0 && (
            <div className="p-3 border-t border-line space-y-2 bg-white">
              <div className="space-y-1 text-xs text-cafe-600">
                <div className="flex justify-between"><span>Tạm tính</span><span>{formatCurrency(baseSubtotal)}</span></div>
                {toppingSubtotal > 0 && <div className="flex justify-between"><span>Topping</span><span>{formatCurrency(toppingSubtotal)}</span></div>}
                <div className="flex justify-between"><span>Giảm giá</span><span>—</span></div>
                <div className="flex justify-between"><span>Thuế</span><span>—</span></div>
              </div>
              <div className="flex justify-between text-sm font-bold text-ink pt-2 border-t border-line">
                <span>Tổng thanh toán</span>
                <span className="text-bean text-base">{formatCurrency(cartTotal)}</span>
              </div>
              {managable ? (
                <>
                  <button onClick={() => setPaymentModal(true)} className="btn-primary w-full py-2.5 mt-1">
                    <CreditCard className="w-4 h-4" />Thanh toán
                  </button>
                  <button onClick={handleCancelOrder} className="btn-ghost w-full text-red-600 hover:bg-red-50 hover:text-red-700">Hủy order</button>
                </>
              ) : (
                <p className="text-xs text-gold-deep bg-gold/12 border border-gold/25 rounded-xl px-3 py-2 mt-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />Gói đã hết hạn — chỉ xem. Gia hạn để thanh toán.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Option Modal */}
      <Modal open={!!optionModal} onClose={() => { setOptionModal(null); setEditCartItemId(null); }} title={optionModal?.item.name ?? ''} size="md">
        {optionModal && (
          <div className="space-y-4">
            {optionModal.item.hasSize && optionModal.item.sizes.length > 0 && (
              <div>
                <label className="label-funcafe">Chọn size <span className="text-red-500">*</span></label>
                <div className="flex gap-2 flex-wrap">
                  {optionModal.item.sizes.filter(s => s.isActive).map(s => (
                    <button key={s.id} onClick={() => setOptForm(f => ({ ...f, size: s }))}
                      className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                        optForm.size?.id === s.id ? 'bg-bean text-white border-bean' : 'border-line text-slate hover:border-bean hover:text-bean'
                      }`}>{s.name} — {formatCurrency(s.price)}</button>
                  ))}
                </div>
              </div>
            )}

            {allowedToppings.length > 0 && (
              <div>
                <label className="label-funcafe">Topping (tuỳ chọn)</label>
                <div className="space-y-0 border border-line rounded-xl overflow-hidden">
                  {allowedToppings.map(top => {
                    const selected = optForm.toppings.find(t => t.toppingId === top.id);
                    return (
                      <label key={top.id} className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer border-b border-line/60 last:border-0 transition-colors ${selected ? 'bg-bean-tint' : 'hover:bg-sand'}`}>
                        <input type="checkbox" checked={!!selected} onChange={() => toggleTopping(top.id)} className="accent-bean" />
                        <span className="flex-1 text-sm text-ink">{top.name}</span>
                        <span className="text-sm text-cafe-500 font-semibold">+{formatCurrency(top.price)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="label-funcafe">Số lượng</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setOptForm(f => ({ ...f, qty: Math.max(1, f.qty - 1) }))} className="w-9 h-9 rounded-xl bg-sand border border-line grid place-items-center hover:border-bean hover:text-bean transition-colors"><Minus className="w-4 h-4" /></button>
                <span className="text-lg font-bold w-8 text-center">{optForm.qty}</span>
                <button onClick={() => setOptForm(f => ({ ...f, qty: f.qty + 1 }))} className="w-9 h-9 rounded-xl bg-sand border border-line grid place-items-center hover:border-bean hover:text-bean transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
            </div>

            <div>
              <label className="label-funcafe">Ghi chú</label>
              <input className="input-funcafe" placeholder="Ít đường, không đá..." value={optForm.note} onChange={e => setOptForm(f => ({ ...f, note: e.target.value }))} />
            </div>

            <div className="pt-3 border-t border-line text-right text-sm text-cafe-600">
              Tạm tính: <span className="font-bold text-bean text-base">{formatCurrency(optTotal)}</span>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setOptionModal(null); setEditCartItemId(null); }} className="btn-secondary flex-1">Hủy</button>
              <button onClick={handleSaveCartItem} disabled={savingItem} className="btn-primary flex-1">{savingItem ? 'Đang lưu...' : editCartItemId ? 'Cập nhật' : 'Thêm vào order'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title="Thanh toán" size="md">
        <div className="space-y-4">
          <div className="bg-sand/70 border border-line rounded-2xl p-4 space-y-1.5">
            <p className="text-xs text-cafe-500">Bàn: <span className="font-semibold text-ink">{selectedTable?.name}</span></p>
            <div className="space-y-1 text-sm text-cafe-600">
              {cart.map(c => (
                <div key={c.id} className="flex justify-between">
                  <span className="truncate max-w-[60%]">{c.item.name}{c.size ? ` (${c.size.name})` : ''} x{c.quantity}</span>
                  <span className="font-medium text-ink">{formatCurrency(calcCartItem(c))}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-line pt-2 mt-2 space-y-1 text-xs text-cafe-500">
              <div className="flex justify-between"><span>Tạm tính</span><span>{formatCurrency(baseSubtotal)}</span></div>
              {toppingSubtotal > 0 && <div className="flex justify-between"><span>Topping</span><span>{formatCurrency(toppingSubtotal)}</span></div>}
              <div className="flex justify-between"><span>Giảm giá</span><span>—</span></div>
              <div className="flex justify-between"><span>Thuế</span><span>—</span></div>
            </div>
            <div className="flex justify-between text-base font-bold text-ink border-t border-line pt-2 mt-1">
              <span>Tổng thanh toán</span>
              <span className="text-bean">{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          <div>
            <label className="label-funcafe">Phương thức thanh toán</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'cash', label: 'Tiền mặt', Icon: Banknote },
                { value: 'vietqr', label: 'VietQR', Icon: VietQrMark },
              ].map(m => (
                <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    paymentMethod === m.value ? 'border-bean bg-bean-tint text-bean ring-1 ring-bean/40' : 'border-line text-slate hover:border-cafe-300'
                  }`}>
                  <m.Icon className="w-4 h-4" />{m.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div>
              <label className="label-funcafe">Tiền khách đưa (đ)</label>
              <input type="text" className="input-funcafe" placeholder="0" value={cashGiven} onChange={e => setCashGiven(e.target.value)} />
              {Number(cashGiven.replace(/\D/g, '')) > 0 && cashChange >= 0 && <p className="text-sm text-pine font-semibold mt-1.5">Tiền thối: {formatCurrency(cashChange)}</p>}
              {Number(cashGiven.replace(/\D/g, '')) > 0 && cashChange < 0 && <p className="text-sm text-red-500 mt-1.5">Chưa đủ {formatCurrency(Math.abs(cashChange))}</p>}
            </div>
          )}

          {paymentMethod === 'vietqr' && (
            cafeInfo?.bankBin && cafeInfo?.bankAccountNumber ? (
              <div className="bg-sand/70 border border-line rounded-2xl p-4 flex flex-col items-center gap-2">
                <img
                  src={buildVietQrImageUrl({
                    bankBin: cafeInfo.bankBin,
                    accountNumber: cafeInfo.bankAccountNumber,
                    accountName: cafeInfo.bankAccountName,
                    amount: cartTotal,
                    addInfo: activeOrders.find(o => o.tableId === selectedTable?.id)?.code || 'Thanh toan FunCafe',
                  })}
                  alt="VietQR"
                  className="w-52 h-52 object-contain bg-white rounded-xl border border-line"
                />
                <p className="text-xs text-cafe-500 text-center">
                  Khách quét mã bằng app ngân hàng để chuyển <strong className="text-bean">{formatCurrency(cartTotal)}</strong> vào tài khoản quán.<br />
                  Sau khi nhận được tiền, bấm <strong>Xác nhận thanh toán</strong>.
                </p>
              </div>
            ) : (
              <div className="bg-gold/10 border border-gold/25 rounded-2xl p-4 text-sm text-gold-deep">
                Quán chưa cấu hình tài khoản ngân hàng nhận tiền.{' '}
                <Link href="/user/cafe" className="font-semibold underline">Cấu hình ngay</Link> để dùng VietQR.
              </div>
            )
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => setPaymentModal(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handlePayment}
              disabled={processing || (paymentMethod === 'cash' && Number(cashGiven.replace(/\D/g, '')) > 0 && cashChange < 0)}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
              <CreditCard className="w-4 h-4" />{processing ? 'Đang xử lý...' : 'Xác nhận thanh toán'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={async () => {
          if (selectedTable) {
            const existingId = draftOrderIds[selectedTable.id];
            if (existingId) {
              try { await orderService.cancel(existingId); } catch {}
              setDraftOrderIds(prev => { const { [selectedTable.id]: _, ...rest } = prev; return rest; });
              setActiveOrders(prev => prev.filter(o => o.id !== existingId));
              // Hủy order -> bàn về trống
              setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'empty' as const, currentOrderId: undefined } : t));
            }
            clearCartForTable(selectedTable.id);
          }
          setSelectedTable(null);
          setClearConfirm(false);
        }}
        title="Hủy order"
        message="Bạn có chắc muốn hủy toàn bộ order hiện tại? Các món đã chọn sẽ bị xóa."
        confirmLabel="Hủy order"
        danger
      />

      {/* Success Modal */}
      <Modal open={!!successModal} onClose={() => setSuccessModal(null)} title="Thanh toán thành công" size="sm">
        {successModal && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-pine/12 rounded-full flex items-center justify-center"><CheckCircle2 className="w-9 h-9 text-pine" /></div>
            </div>
            <div>
              <p className="text-cafe-500 text-sm">Mã hóa đơn</p>
              <p className="text-2xl font-bold text-ink font-mono">{successModal.code}</p>
            </div>
            <div className="bg-bean-tint rounded-2xl py-3 px-4">
              <p className="text-cafe-500 text-xs">Tổng thanh toán</p>
              <p className="text-xl font-bold text-bean">{formatCurrency(successModal.total)}</p>
            </div>
            {successModal.cashGiven != null && (
              <div className="flex justify-between text-sm px-1">
                <span className="text-cafe-500">Tiền khách đưa</span>
                <span className="font-semibold text-ink">{formatCurrency(successModal.cashGiven)}</span>
              </div>
            )}
            {successModal.change != null && (
              <div className="flex justify-between text-sm px-1 -mt-2">
                <span className="text-cafe-500">Tiền thối</span>
                <span className="font-bold text-pine">{formatCurrency(successModal.change)}</span>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setSuccessModal(null); window.open('/user/invoices', '_blank'); }} className="btn-secondary flex-1 text-sm"><Receipt className="w-4 h-4" />In hóa đơn</button>
              <button onClick={() => setSuccessModal(null)} className="btn-primary flex-1 text-sm">Tạo order mới</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
