'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import LockedButton from '@/components/ui/LockedButton';
import { useAuth } from '@/context/AuthContext';
import { toppingService } from '@/services';
import { canManage } from '@/lib/permission';
import { formatCurrency, formatThousands, parseThousands } from '@/lib/format';
import { generateId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import ImageUpload from '@/components/ui/ImageUpload';
import EmptyState from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/user/FilterBar';
import StatusBadge from '@/components/user/StatusBadge';
import type { Topping } from '@/types';
import { Plus, Pencil, EyeOff, RotateCcw, Image as ImageIcon, CupSoda } from 'lucide-react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

export default function ToppingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const managable = canManage(user?.subscription);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Topping | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Topping>>({ name: '', price: 0, isAvailable: true });

  const load = () => {
    setLoading(true);
    toppingService.list().then(setToppings).catch(() => toast({ description: 'Không thể tải danh sách topping', variant: 'destructive' })).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = toppings.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const openAdd = () => { setEditTarget(null); setForm({ name: '', price: 0, isAvailable: true }); setModalOpen(true); };
  const openEdit = (t: Topping) => { setEditTarget(t); setForm(t); setModalOpen(true); };
  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await toppingService.update(editTarget.id, form);
        setToppings(prev => prev.map(t => t.id === editTarget.id ? updated : t));
        toast({ description: 'Đã cập nhật topping' });
      } else {
        const created = await toppingService.create(form);
        setToppings(prev => [...prev, created]);
        toast({ description: 'Đã thêm topping mới' });
      }
      setModalOpen(false);
    } catch {
      toast({ description: 'Lưu thất bại', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Topping KHÔNG xóa được (từng bán còn trong hóa đơn cũ) — chỉ ẩn/mở bán lại.
  const handleToggleAvailable = async (t: Topping) => {
    try {
      const updated = await toppingService.update(t.id, { isAvailable: !t.isAvailable });
      setToppings(prev => prev.map(x => x.id === t.id ? updated : x));
      toast({ description: updated.isAvailable ? `Đã mở bán lại "${t.name}"` : `Đã ẩn topping "${t.name}"` });
    } catch {
      toast({ description: 'Cập nhật thất bại', variant: 'destructive' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Quản lý Topping"
        description={`${toppings.length} topping`}
        actions={managable
          ? <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" />Thêm topping</button>
          : <LockedButton>Thêm topping</LockedButton>}
      />

      {loading && <LoadingSkeleton variant="list" rows={5} />}
      {!loading && (<>      <div className="mb-5 max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên topping..." />
      </div>

      <div className="bg-white rounded-2xl border border-line overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-sand border-b border-line">
            <tr>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold w-16">Ảnh</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Tên topping</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Giá</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Trạng thái</th>
              <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-sand/50 transition-colors">
                <td className="px-4 py-3">
                  {t.imageUrl ? (
                    <img src={t.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover border border-line" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-sand border border-line flex items-center justify-center text-cafe-300"><ImageIcon className="w-4 h-4" /></div>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold text-ink">{t.name}</td>
                <td className="px-4 py-3 font-semibold text-bean">{formatCurrency(t.price)}</td>
                <td className="px-4 py-3"><StatusBadge tone={t.isAvailable ? 'success' : 'neutral'}>{t.isAvailable ? 'Còn phục vụ' : 'Hết phục vụ'}</StatusBadge></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(t)} className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                    {managable ? (
                      <button onClick={() => handleToggleAvailable(t)}
                        title={t.isAvailable ? 'Ẩn topping (ngừng bán)' : 'Mở bán lại'}
                        className={`p-2 rounded-lg transition-colors ${t.isAvailable ? 'text-cafe-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-500 hover:text-pine hover:bg-pine/10'}`}>
                        {t.isAvailable ? <EyeOff className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                      </button>
                    ) : (
                      <LockedButton className="p-2 text-xs"><EyeOff className="w-3.5 h-3.5" /></LockedButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5}>
                {toppings.length === 0
                  ? <EmptyState icon={CupSoda} title="Bạn chưa thêm topping nào" description="Thêm topping đầu tiên để khách có thêm lựa chọn khi gọi món." />
                  : <EmptyState icon={CupSoda} title="Không tìm thấy topping nào" description="Thử đổi từ khóa tìm kiếm." />}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Chỉnh sửa topping' : 'Thêm topping mới'}>
        <div className="space-y-4">
          <div>
            <label className="label-funcafe">Tên topping <span className="text-red-500">*</span></label>
            <input className="input-funcafe" placeholder="VD: Trân châu đen" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label-funcafe">Giá (đ)</label>
            <input type="text" inputMode="numeric" className="input-funcafe" placeholder="0"
              value={formatThousands(form.price ?? 0)} onChange={e => setForm({ ...form, price: parseThousands(e.target.value) })} />
          </div>
          <div>
            <label className="label-funcafe">Ảnh topping</label>
            <ImageUpload currentImage={form.imageUrl} onUpload={(url) => setForm({ ...form, imageUrl: url })} onRemove={() => setForm({ ...form, imageUrl: undefined })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-cafe-700 cursor-pointer">
            <input type="checkbox" checked={form.isAvailable ?? true} onChange={e => setForm({ ...form, isAvailable: e.target.checked })} />
            Còn phục vụ
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            {managable ? (
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Đang lưu...' : editTarget ? 'Cập nhật' : 'Thêm topping'}</button>
            ) : (
              <LockedButton className="flex-1">{editTarget ? 'Cập nhật' : 'Thêm topping'}</LockedButton>
            )}
          </div>
        </div>
      </Modal>

      </>)}
    </div>
  );
}
