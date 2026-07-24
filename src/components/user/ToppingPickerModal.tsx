'use client';
import { useState } from 'react';
import { X, Check, Search, CupSoda } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Topping } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  toppings: Topping[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

/**
 * Popup chọn topping cho món: có ảnh + tên + giá + ô tìm kiếm. Chọn trực tiếp
 * (cập nhật ngay), bấm "Xong" để đóng. z-[70] để nổi trên modal thêm/sửa món.
 */
export default function ToppingPickerModal({ open, onClose, toppings, selectedIds, onToggle }: Props) {
  const [q, setQ] = useState('');
  if (!open) return null;

  const filtered = toppings.filter(t => t.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-pop w-full max-w-xl max-h-[85vh] flex flex-col anim-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-bean-tint text-bean flex items-center justify-center shrink-0"><CupSoda className="w-4 h-4" /></span>
            <h2 className="text-lg font-bold text-ink">Chọn topping</h2>
            <span className="text-sm text-cafe-400 whitespace-nowrap">· đã chọn {selectedIds.length}</span>
          </div>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-lg text-cafe-400 hover:text-bean hover:bg-sand transition-colors" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="w-4 h-4 text-cafe-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="input-funcafe pl-10" placeholder="Tìm topping theo tên..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-cafe-500 text-center py-8">Không tìm thấy topping nào.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filtered.map(t => {
                const selected = selectedIds.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => onToggle(t.id)}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${selected ? 'border-bean bg-bean-tint ring-1 ring-bean' : 'border-line hover:border-cafe-300'}`}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-sand ring-1 ring-line shrink-0 flex items-center justify-center">
                      {t.imageUrl ? (
                        <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover" />
                      ) : (
                        <CupSoda className="w-5 h-5 text-cafe-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink truncate">{t.name}</p>
                      <p className="text-xs text-cafe-500">{formatCurrency(t.price)}{!t.isAvailable && ' · đang ẩn'}</p>
                    </div>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${selected ? 'bg-bean text-white' : 'border border-line bg-white'}`}>
                      {selected && <Check className="w-4 h-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line flex items-center justify-between">
          <span className="text-sm text-cafe-500">Đã chọn <span className="font-semibold text-ink">{selectedIds.length}</span> topping</span>
          <button onClick={onClose} className="btn-primary">Xong</button>
        </div>
      </div>
    </div>
  );
}
