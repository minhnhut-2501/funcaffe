/**
 * "Ảnh mô tả chức năng" = bản thu nhỏ thật của giao diện sản phẩm (component preview),
 * không phải ảnh chụp giả. Mỗi shot minh hoạ một nhóm chức năng, dùng đúng palette brand.
 */
import { Check, Plus, Coffee, Receipt, CreditCard, TrendingUp } from 'lucide-react';

function Frame({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="card-public p-4 sm:p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-bean/30" />
          <span className="w-2.5 h-2.5 rounded-full bg-gold/40" />
          <span className="w-2.5 h-2.5 rounded-full bg-pine/30" />
        </div>
        <p className="text-xs font-medium text-ink/45">{title}</p>
        {tag ? <span className="chip py-0.5">{tag}</span> : <span className="w-10" />}
      </div>
      {children}
    </div>
  );
}

/** Quản lý bàn: sơ đồ trạng thái bàn */
export function TableMapShot() {
  const states = ['serving', 'empty', 'serving', 'cleaning', 'empty', 'serving', 'empty', 'reserved', 'empty', 'serving', 'empty', 'empty'];
  return (
    <Frame title="Sơ đồ bàn" tag="Realtime">
      <div className="grid grid-cols-4 gap-2 mb-4">
        {states.map((st, i) => (
          <div
            key={i}
            className={`h-12 rounded-lg border flex items-center justify-center text-xs font-medium ${
              st === 'serving' ? 'bg-bean text-white border-bean'
              : st === 'cleaning' ? 'bg-gold/20 text-bean border-gold/40'
              : st === 'reserved' ? 'bg-pine/15 text-pine border-pine/30'
              : 'bg-paper text-ink/45 border-line'
            }`}
          >
            B{i + 1}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink/55">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-bean" />Đang phục vụ</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-gold/60" />Cần dọn</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-pine/60" />Đã đặt</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-line" />Trống</span>
      </div>
    </Frame>
  );
}

/** Thực đơn, size, topping */
export function MenuShot() {
  const items = [
    { name: 'Cà phê sữa', size: 'M', price: '29.000', on: true },
    { name: 'Trà đào cam sả', size: 'L', price: '45.000', on: true },
    { name: 'Bạc xỉu', size: 'M', price: '32.000', on: false },
  ];
  return (
    <Frame title="Thực đơn" tag="Size · Topping">
      <div className="flex gap-2 mb-3">
        {['Tất cả', 'Cà phê', 'Trà', 'Đá xay'].map((c, i) => (
          <span key={c} className={`text-xs px-2.5 py-1 rounded-full ${i === 1 ? 'bg-bean text-white' : 'bg-paper text-ink/55 border border-line'}`}>{c}</span>
        ))}
      </div>
      <div className="space-y-2">
        {items.map((m) => (
          <div key={m.name} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
            <span className="w-9 h-9 rounded-lg bg-paper border border-line flex items-center justify-center shrink-0">
              <Coffee className="w-4 h-4 text-bean" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">{m.name}</p>
              <p className="text-[11px] text-ink/45">Size {m.size} · {m.price}đ</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.on ? 'bg-pine/15 text-pine' : 'bg-line text-ink/45'}`}>
              {m.on ? 'Còn bán' : 'Tạm hết'}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Tạo order / thêm món */
export function OrderShot() {
  const lines = [
    { name: 'Cà phê sữa (M)', qty: 2, total: '58.000' },
    { name: 'Trà đào cam sả (L)', qty: 1, total: '45.000' },
    { name: 'Bánh mì chảo', qty: 1, total: '39.000' },
  ];
  return (
    <Frame title="Order · Bàn B3" tag="Đang mở">
      <div className="space-y-2 mb-3">
        {lines.map((l) => (
          <div key={l.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-ink/80">
              <span className="w-5 h-5 rounded bg-bean/10 text-bean text-[11px] font-semibold flex items-center justify-center">{l.qty}</span>
              {l.name}
            </span>
            <span className="text-ink/60 text-xs">{l.total}đ</span>
          </div>
        ))}
      </div>
      <button className="w-full rounded-lg border border-dashed border-line py-2 text-xs text-bean flex items-center justify-center gap-1.5 mb-3">
        <Plus className="w-4 h-4" /> Thêm món
      </button>
      <div className="flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm text-ink/60">Tạm tính</span>
        <span className="text-base font-bold text-bean">142.000đ</span>
      </div>
    </Frame>
  );
}

/** Thanh toán & hóa đơn */
export function PaymentShot() {
  const methods = [
    { icon: CreditCard, label: 'Chuyển khoản / QR', on: true },
    { icon: Receipt, label: 'Tiền mặt', on: false },
  ];
  return (
    <Frame title="Thanh toán" tag="Bàn B3">
      <div className="rounded-xl bg-paper border border-line p-4 mb-3 text-center">
        <p className="text-xs text-ink/50 mb-1">Tổng thanh toán</p>
        <p className="text-2xl font-bold text-bean">142.000đ</p>
      </div>
      <div className="space-y-2 mb-3">
        {methods.map((m) => (
          <div key={m.label} className={`flex items-center gap-3 rounded-lg border p-2.5 ${m.on ? 'border-bean bg-bean/5' : 'border-line'}`}>
            <m.icon className={`w-4 h-4 ${m.on ? 'text-bean' : 'text-ink/40'}`} />
            <span className="text-sm text-ink/80 flex-1">{m.label}</span>
            {m.on && <Check className="w-4 h-4 text-bean" />}
          </div>
        ))}
      </div>
      <button className="btn-cafe w-full py-2.5 text-sm">Xác nhận & in hóa đơn</button>
    </Frame>
  );
}

/** Báo cáo doanh thu (mini chart) */
export function ReportShot() {
  const bars = [40, 62, 48, 80, 56, 95, 72];
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  return (
    <Frame title="Báo cáo doanh thu" tag="7 ngày">
      <div className="flex items-end justify-between gap-2 h-28 mb-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1.5">
            <div
              className={`w-full rounded-t-md ${i === 5 ? 'bg-bean' : 'bg-bean/25'}`}
              style={{ height: `${h}%` }}
            />
            <span className="text-[10px] text-ink/45">{days[i]}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-3">
        <span className="text-xs text-ink/55 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-pine" /> Tuần này
        </span>
        <span className="text-sm font-bold text-ink">12.480.000đ</span>
      </div>
    </Frame>
  );
}
