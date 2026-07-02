'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import LockedButton from '@/components/ui/LockedButton';
import { useAuth } from '@/context/AuthContext';
import { menuService, toppingService, itemToppingService } from '@/services';
import { canEdit } from '@/lib/permission';
import type { MenuItem, Topping } from '@/types';
import SectionCard from '@/components/user/SectionCard';
import { AlertCircle, UtensilsCrossed, Settings, CheckCircle2 } from 'lucide-react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

export default function ItemToppingsPage() {
  const { user } = useAuth();
  const pkg = user?.subscription.packageType ?? 'none';
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [config, setConfig] = useState<Record<string, string[]>>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      menuService.list().then(items => {
        setMenuItems(items);
        // Seed sẵn số topping đã chọn của TẤT CẢ món để hiện đúng ngay (không cần bấm vào từng món)
        const seeded: Record<string, string[]> = {};
        items.forEach(i => { if (i.allowTopping) seeded[i.id] = i.allowedToppingIds ?? []; });
        setConfig(prev => ({ ...seeded, ...prev }));
        const first = items.find(i => i.allowTopping);
        if (first) setSelectedItemId(first.id);
      }),
      toppingService.list().then(setToppings),
    ]).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedItemId) return;
    itemToppingService.get(selectedItemId).then(ids => {
      setConfig(prev => ({ ...prev, [selectedItemId!]: ids }));
    }).catch(() => {});
  }, [selectedItemId]);

  const allowedItems = menuItems.filter(i => i.allowTopping);
  const currentToppingIds = config[selectedItemId ?? ''] ?? [];
  const selItem = menuItems.find(i => i.id === selectedItemId);

  const toggleTopping = (toppingId: string) => {
    if (!selectedItemId) return;
    setConfig(prev => {
      const curr = prev[selectedItemId] ?? [];
      const next = curr.includes(toppingId) ? curr.filter(id => id !== toppingId) : [...curr, toppingId];
      return { ...prev, [selectedItemId]: next };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedItemId) return;
    setSaving(true);
    try {
      await itemToppingService.update(selectedItemId, currentToppingIds);
      setSaved(true);
    } catch { }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Cấu hình Topping cho món" description="Chọn topping nào được áp dụng cho từng món" />

      {loading && <LoadingSkeleton variant="list" rows={5} />}
      {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải dữ liệu. Vui lòng thử lại sau.</span></div>}
      {!loading && !error && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <SectionCard title={`Món có topping (${allowedItems.length})`} icon={UtensilsCrossed}>
          {allowedItems.length === 0 ? (
            <p className="text-cafe-400 text-sm">Chưa có món nào bật "Cho phép topping". Vào Thực đơn để bật.</p>
          ) : (
            <div className="space-y-1.5">
              {allowedItems.map(item => (
                <button key={item.id} onClick={() => { setSelectedItemId(item.id); setSaved(false); }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors border ${selectedItemId === item.id ? 'bg-bean text-white border-bean' : 'border-transparent hover:bg-sand text-ink'}`}>
                  <span className="font-semibold">{item.name}</span>
                  <span className={`ml-2 text-xs ${selectedItemId === item.id ? 'text-white/70' : 'text-cafe-400'}`}>
                    {(config[item.id] ?? []).length} topping đã chọn
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={selItem ? `Topping cho: ${selItem.name}` : 'Cấu hình topping'} subtitle={selItem ? 'Chọn các topping được phép dùng với món này' : undefined} icon={Settings}>
          {!selItem ? (
            <div className="text-center text-cafe-400 py-12"><p className="text-sm">Chọn một món ở bên trái để cấu hình topping</p></div>
          ) : (
            <>
              <div className="space-y-1.5 mb-4 border border-line rounded-xl overflow-hidden">
                {toppings.map(top => {
                  const checked = currentToppingIds.includes(top.id);
                  return (
                    <label key={top.id} className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer border-b border-line/60 last:border-0 transition-colors ${checked ? 'bg-bean-tint' : 'hover:bg-sand'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleTopping(top.id)} className="rounded accent-bean" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-ink">{top.name}</p>
                        {!top.isAvailable && <span className="text-xs text-red-400">Hết phục vụ</span>}
                      </div>
                      <span className="text-xs text-cafe-500 font-medium">+{top.price.toLocaleString('vi-VN')}đ</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2 items-center">
                {saved && <p className="text-pine text-sm font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Đã lưu cấu hình</p>}
                <div className="flex-1" />
                {canEdit(pkg) ? <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</button> : <LockedButton>Lưu cấu hình</LockedButton>}
              </div>
            </>
          )}
        </SectionCard>
      </div>
      )}
    </div>
  );
}
