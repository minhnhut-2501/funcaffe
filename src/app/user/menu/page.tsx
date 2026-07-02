'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import LockedButton from '@/components/ui/LockedButton';
import { useAuth } from '@/context/AuthContext';
import { menuService, categoryService } from '@/services';
import { canEdit, packageLimits } from '@/lib/permission';
import { formatCurrency } from '@/lib/format';
import { generateId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import ImageUpload from '@/components/ui/ImageUpload';
import EmptyState from '@/components/ui/EmptyState';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge from '@/components/user/StatusBadge';
import type { MenuItem, MenuItemSize } from '@/types';
import { Plus, Pencil, Trash2, Eye, RotateCcw, FolderPlus, Image as ImageIcon, UtensilsCrossed, AlertCircle } from 'lucide-react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

export default function MenuPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const pkg = user?.subscription.packageType ?? 'none';
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof categoryService.list>>>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [sizeFilter, setSizeFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [toppingFilter, setToppingFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<MenuItem | null>(null);
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catEditModal, setCatEditModal] = useState<{ open: boolean; target?: { id?: string; name: string; description?: string; isActive: boolean } }>({ open: false, target: { name: '', isActive: true } });

  const load = () => {
    setLoading(true);
    Promise.all([
      menuService.list().then(setItems),
      categoryService.list().then(setCategories),
    ]).catch(() => toast({ description: 'Không thể tải thực đơn', variant: 'destructive' })).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const emptyForm = (): Partial<MenuItem> => ({
    name: '', basePrice: 0, categoryId: categories[0]?.id ?? '', description: '',
    hasSize: false, sizes: [], allowTopping: false, allowedToppingIds: [], isAvailable: true,
  });
  const [form, setForm] = useState<Partial<MenuItem>>(emptyForm());

  const filtered = items.filter(i =>
    (catFilter === 'all' || i.categoryId === catFilter) &&
    (statusFilter === 'all' || (statusFilter === 'available' ? i.isAvailable : !i.isAvailable)) &&
    (sizeFilter === 'all' || (sizeFilter === 'yes' ? i.hasSize : !i.hasSize)) &&
    (toppingFilter === 'all' || (toppingFilter === 'yes' ? i.allowTopping : !i.allowTopping)) &&
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  // Giới hạn theo gói (Pro: tối đa 15 món; Free/Pro Max: không giới hạn).
  // Chỉ áp cho gói có quyền chỉnh sửa & có trần hữu hạn (Pro) — bỏ qua 'none'.
  const limits = packageLimits(user?.subscription);
  const hasItemCap = canEdit(pkg) && Number.isFinite(limits.maxMenuItems);
  const atItemLimit = hasItemCap && items.length >= limits.maxMenuItems;

  const resetFilters = () => { setSearch(''); setCatFilter('all'); setStatusFilter('all'); setSizeFilter('all'); setToppingFilter('all'); };
  const openAdd = () => { setEditTarget(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (item: MenuItem) => { setEditTarget(item); setForm({ ...item, sizes: [...item.sizes] }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast({ description: 'Vui lòng nhập tên món', variant: 'destructive' }); return; }
    if (!editTarget && atItemLimit) {
      toast({ description: `Gói Pro chỉ cho phép tối đa ${limits.maxMenuItems} món. Nâng cấp lên Pro Max để thêm không giới hạn.`, variant: 'destructive' });
      return;
    }
    // Ràng buộc size khi món có size
    if (form.hasSize) {
      const sizes = form.sizes ?? [];
      if (sizes.length === 0) {
        toast({ description: 'Món có size thì phải thêm ít nhất một size', variant: 'destructive' }); return;
      }
      if (sizes.some(s => !s.name.trim())) {
        toast({ description: 'Vui lòng nhập tên cho tất cả size (VD: S, M, L)', variant: 'destructive' }); return;
      }
      const names = sizes.map(s => s.name.trim().toLowerCase());
      if (new Set(names).size !== names.length) {
        toast({ description: 'Tên size không được trùng nhau', variant: 'destructive' }); return;
      }
      if (sizes.some(s => !(s.price > 0))) {
        toast({ description: 'Vui lòng nhập giá hợp lệ cho tất cả size', variant: 'destructive' }); return;
      }
    }
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await menuService.update(editTarget.id, form);
        setItems(prev => prev.map(i => i.id === editTarget.id ? updated : i));
        toast({ description: 'Đã cập nhật món' });
      } else {
        const created = await menuService.create(form);
        setItems(prev => [...prev, created]);
        toast({ description: 'Đã thêm món mới' });
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error('Save error:', err?.errors || err?.message || err);
      const msg = err?.errors ? Object.values(err.errors).flat().join(', ') : (err?.message || 'Lưu thất bại');
      toast({ description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await menuService.remove(deleteTarget.id);
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ description: 'Đã xóa món' });
    } catch {
      toast({ description: 'Xóa thất bại', variant: 'destructive' });
    }
  };

  const addSize = () => {
    const newSize: MenuItemSize = { id: generateId('sz'), name: '', price: 0, isActive: true };
    setForm(f => ({ ...f, sizes: [...(f.sizes ?? []), newSize] }));
  };
  const updateSize = (idx: number, field: keyof MenuItemSize, value: string | number | boolean) => {
    setForm(f => ({ ...f, sizes: f.sizes?.map((s, i) => i === idx ? { ...s, [field]: value } : s) }));
  };
  const removeSize = (idx: number) => {
    setForm(f => ({ ...f, sizes: f.sizes?.filter((_, i) => i !== idx) }));
  };

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? '—';

  const handleCatSave = async () => {
    const t = catEditModal.target;
    if (!t?.name) return;
    try {
      if (t.id) {
        await categoryService.update(t.id, { name: t.name, description: t.description, is_active: t.isActive });
      } else {
        const created = await categoryService.create({ name: t.name, description: t.description, is_active: t.isActive });
        setForm(f => ({ ...f, categoryId: created.id }));
      }
      await categoryService.list().then(setCategories);
      setCatEditModal({ open: false, target: { name: '', isActive: true } });
      toast({ description: 'Đã lưu danh mục' });
    } catch (err: any) { toast({ description: err?.errors ? Object.values(err.errors).flat().join(', ') : (err?.message || 'Lưu danh mục thất bại'), variant: 'destructive' }); }
  };
  const handleCatDelete = async (id: string) => {
    try {
      await categoryService.remove(id);
      await categoryService.list().then(setCategories);
      if (catFilter === id) setCatFilter('all');
      toast({ description: 'Đã xóa danh mục' });
    } catch { toast({ description: 'Xóa danh mục thất bại', variant: 'destructive' }); }
  };

  return (
    <div>
      <PageHeader title="Thực đơn" description="Quản lý món, giá bán, size và topping của quán."
        actions={<div className="flex items-center gap-2">
          {hasItemCap && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${atItemLimit ? 'bg-red-50 text-red-600 border-red-200' : 'bg-sand text-cafe-600 border-line'}`}>
              {items.length}/{limits.maxMenuItems} món
            </span>
          )}
          <button onClick={() => setCatEditModal({ open: true, target: { name: '', isActive: true } })} className="btn-secondary flex items-center gap-1.5 text-sm"><FolderPlus className="w-4 h-4" />Thêm danh mục</button>
          <button onClick={openAdd} disabled={atItemLimit}
            title={atItemLimit ? `Gói Pro tối đa ${limits.maxMenuItems} món — nâng cấp Pro Max để không giới hạn` : undefined}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Plus className="w-4 h-4" />Thêm món</button>
        </div>} />

      {loading && <LoadingSkeleton variant="table" rows={6} cols={5} />}
      {!loading && (<>

      {atItemLimit && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Bạn đã đạt giới hạn {limits.maxMenuItems} món của gói Pro. <a href="/user/subscription" className="font-semibold underline">Nâng cấp Pro Max</a> để thêm món không giới hạn.</span>
        </div>
      )}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm món..." />
        <select className="input-funcafe !w-auto min-w-[150px]" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="all">Tất cả danh mục</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input-funcafe !w-auto min-w-[150px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'available' | 'unavailable')}>
          <option value="all">Tất cả trạng thái</option>
          <option value="available">Đang bán</option>
          <option value="unavailable">Hết món</option>
        </select>
        <select className="input-funcafe !w-auto min-w-[150px]" value={sizeFilter} onChange={e => setSizeFilter(e.target.value as 'all' | 'yes' | 'no')}>
          <option value="all">Tất cả (size)</option>
          <option value="yes">Có size</option>
          <option value="no">Không size</option>
        </select>
        <select className="input-funcafe !w-auto min-w-[150px]" value={toppingFilter} onChange={e => setToppingFilter(e.target.value as 'all' | 'yes' | 'no')}>
          <option value="all">Tất cả (topping)</option>
          <option value="yes">Có topping</option>
          <option value="no">Không topping</option>
        </select>
        <button onClick={resetFilters} className="btn-secondary"><RotateCcw className="w-3.5 h-3.5" />Đặt lại</button>
      </FilterBar>

      <div className="bg-white rounded-2xl border border-line overflow-x-auto shadow-soft">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-sand border-b border-line">
            <tr>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold w-16">Ảnh</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Tên món</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Danh mục</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Giá</th>
              <th className="text-center px-4 py-3 text-cafe-600 font-semibold">Có size</th>
              <th className="text-center px-4 py-3 text-cafe-600 font-semibold">Cho topping</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Trạng thái</th>
              <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {filtered.map(item => {
              const minPrice = item.hasSize && item.sizes.length > 0
                ? Math.min(...item.sizes.filter(s => s.isActive).map(s => s.price))
                : item.basePrice;
              return (
                <tr key={item.id} className="hover:bg-sand/50 transition-colors">
                  <td className="px-4 py-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover border border-line" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-sand border border-line flex items-center justify-center text-cafe-300"><ImageIcon className="w-4 h-4" /></div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{item.name}</td>
                  <td className="px-4 py-3 text-cafe-600">{getCatName(item.categoryId)}</td>
                  <td className="px-4 py-3 font-semibold text-bean">{item.hasSize ? `Từ ${formatCurrency(minPrice)}` : formatCurrency(item.basePrice)}</td>
                  <td className="px-4 py-3 text-center text-cafe-500">{item.hasSize ? <span className="badge-free text-xs">Có</span> : '—'}</td>
                  <td className="px-4 py-3 text-center text-cafe-500">{item.allowTopping ? <span className="badge-pro text-xs">Có</span> : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge tone={item.isAvailable ? 'success' : 'neutral'}>{item.isAvailable ? 'Đang bán' : 'Hết món'}</StatusBadge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setViewTarget(item)} title="Xem" className="p-2 text-cafe-400 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(item)} title="Sửa" className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                      {canEdit(pkg) ? (
                        <button onClick={() => setDeleteTarget(item)} title="Xóa" className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      ) : (
                        <LockedButton variant="danger" className="p-2 text-xs"><Trash2 className="w-3.5 h-3.5" /></LockedButton>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8}><EmptyState icon={UtensilsCrossed} title="Không tìm thấy món nào" description="Thử đổi bộ lọc hoặc thêm món mới vào thực đơn." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Chi tiết món" size="md">
        {viewTarget && (
          <div className="space-y-3 text-sm">
            {viewTarget.imageUrl && (
              <div className="flex justify-center pb-1">
                <img src={viewTarget.imageUrl} alt={viewTarget.name} className="w-36 h-36 rounded-xl object-cover border border-cafe-100" />
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-cafe-50"><span className="text-cafe-500">Tên món</span><span className="font-medium text-cafe-800">{viewTarget.name}</span></div>
            <div className="flex justify-between py-2 border-b border-cafe-50"><span className="text-cafe-500">Danh mục</span><span className="text-cafe-700">{getCatName(viewTarget.categoryId)}</span></div>
            <div className="flex justify-between py-2 border-b border-cafe-50"><span className="text-cafe-500">Giá mặc định</span><span className="font-medium text-cafe-700">{formatCurrency(viewTarget.basePrice)}</span></div>
            {viewTarget.description && (<div className="py-2 border-b border-cafe-50"><span className="text-cafe-500">Mô tả</span><p className="text-cafe-700 mt-1">{viewTarget.description}</p></div>)}
            <div className="flex justify-between py-2 border-b border-cafe-50"><span className="text-cafe-500">Trạng thái</span><span className={viewTarget.isAvailable ? 'badge-active' : 'badge-inactive'}>{viewTarget.isAvailable ? 'Đang bán' : 'Hết món'}</span></div>
            {viewTarget.hasSize && viewTarget.sizes.length > 0 && (
              <div className="py-2 border-b border-cafe-50">
                <span className="text-cafe-500">Danh sách size</span>
                <div className="mt-2 space-y-1">
                  {viewTarget.sizes.map(s => (
                    <div key={s.id} className="flex justify-between text-cafe-700 bg-cafe-50 rounded px-3 py-1.5">
                      <span>Size {s.name}</span><span className="font-medium">{formatCurrency(s.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between py-2"><span className="text-cafe-500">Cho phép topping</span><span>{viewTarget.allowTopping ? 'Có' : 'Không'}</span></div>
            <button onClick={() => setViewTarget(null)} className="btn-secondary w-full mt-2">Đóng</button>
          </div>
        )}
      </Modal>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Chỉnh sửa món' : 'Thêm món mới'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-funcafe">Tên món <span className="text-red-500">*</span></label>
              <input className="input-funcafe" placeholder="VD: Trà sữa truyền thống" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label-funcafe">Danh mục</label>
              <div className="flex gap-2">
                <select className="input-funcafe flex-1" value={form.categoryId ?? ''} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setCatEditModal({ open: true, target: { name: '', isActive: true } })} className="btn-secondary flex items-center gap-1 px-2 shrink-0" title="Thêm danh mục mới"><FolderPlus className="w-4 h-4" /></button>
              </div>
            </div>
            <div>
              <label className="label-funcafe">Giá mặc định (đ)</label>
              <input type="number" min={0} className="input-funcafe" value={form.basePrice ?? 0} onChange={e => setForm({ ...form, basePrice: Number(e.target.value) })} />
            </div>
            <div className="col-span-2">
              <label className="label-funcafe">Ảnh món</label>
              <ImageUpload currentImage={form.imageUrl} onUpload={(url) => setForm({ ...form, imageUrl: url })} onRemove={() => setForm({ ...form, imageUrl: undefined })} />
            </div>
            <div className="col-span-2">
              <label className="label-funcafe">Mô tả</label>
              <textarea rows={2} className="input-funcafe resize-none" placeholder="Mô tả ngắn về món..." value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-cafe-700 cursor-pointer">
              <input type="checkbox" checked={form.hasSize ?? false}
                onChange={e => setForm({ ...form, hasSize: e.target.checked, sizes: e.target.checked ? (form.sizes?.length ? form.sizes : [{ id: generateId('sz'), name: 'M', price: form.basePrice ?? 0, isActive: true }]) : [] })} />
              Có size
            </label>
            <label className="flex items-center gap-2 text-sm text-cafe-700 cursor-pointer">
              <input type="checkbox" checked={form.allowTopping ?? false} onChange={e => setForm({ ...form, allowTopping: e.target.checked })} />
              Cho phép topping
            </label>
            <label className="flex items-center gap-2 text-sm text-cafe-700 cursor-pointer">
              <input type="checkbox" checked={form.isAvailable ?? true} onChange={e => setForm({ ...form, isAvailable: e.target.checked })} />
              Đang bán
            </label>
          </div>

          {form.hasSize && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-funcafe mb-0">Danh sách size</label>
                <button type="button" onClick={addSize} className="text-xs text-cafe-700 hover:underline font-medium">+ Thêm size</button>
              </div>
              <div className="space-y-2">
                {(form.sizes ?? []).map((sz, idx) => (
                  <div key={sz.id} className="flex gap-2 items-center">
                    <div className="flex-1 min-w-0">
                      <input className="input-funcafe" placeholder="Tên size (S / M / L)" value={sz.name} onChange={e => updateSize(idx, 'name', e.target.value)} />
                    </div>
                    <div className="w-28 shrink-0">
                      <input type="number" min={0} className="input-funcafe" placeholder="Giá (đ)" value={sz.price} onChange={e => updateSize(idx, 'price', Number(e.target.value))} />
                    </div>
                    <label className="flex items-center gap-1 text-xs text-cafe-600 whitespace-nowrap shrink-0">
                      <input type="checkbox" checked={sz.isActive} onChange={e => updateSize(idx, 'isActive', e.target.checked)} />Bật
                    </label>
                    <button type="button" onClick={() => removeSize(idx)} className="text-red-400 hover:text-red-600 p-1 shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {(form.sizes ?? []).length === 0 && (<p className="text-xs text-cafe-400 text-center py-2">Chưa có size nào. Nhấn "+ Thêm size" để thêm.</p>)}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            {canEdit(pkg) ? (
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Đang lưu...' : editTarget ? 'Cập nhật' : 'Lưu'}</button>
            ) : (
              <LockedButton className="flex-1">{editTarget ? 'Cập nhật' : 'Lưu'}</LockedButton>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa món" message={`Bạn có chắc muốn xóa món "${deleteTarget?.name}" không?`} confirmLabel="Xóa" danger />

      {/* Category Edit Modal */}
      <Modal open={catEditModal.open} onClose={() => setCatEditModal({ open: false, target: { name: '', isActive: true } })} title={catEditModal.target?.id ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label-funcafe">Tên danh mục <span className="text-red-500">*</span></label>
            <input className="input-funcafe" placeholder="VD: Trà sữa" value={catEditModal.target?.name ?? ''} onChange={e => setCatEditModal(m => ({ ...m, target: { ...m.target!, name: e.target.value } }))} />
          </div>
          <div>
            <label className="label-funcafe">Mô tả</label>
            <textarea rows={2} className="input-funcafe resize-none" placeholder="Mô tả ngắn..." value={catEditModal.target?.description ?? ''} onChange={e => setCatEditModal(m => ({ ...m, target: { ...m.target!, description: e.target.value } }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-cafe-700 cursor-pointer">
            <input type="checkbox" checked={catEditModal.target?.isActive ?? true}
              onChange={e => setCatEditModal(m => ({ ...m, target: { ...m.target!, isActive: e.target.checked } }))} />
            Đang hiển thị
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setCatEditModal({ open: false, target: { name: '', isActive: true } })} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleCatSave} className="btn-primary flex-1">{catEditModal.target?.id ? 'Cập nhật' : 'Thêm'}</button>
          </div>
        </div>
      </Modal>

      {/* Category list management */}
      {categories.length === 0 && (
        <div className="mt-4 p-4 bg-gold/10 border border-gold/25 rounded-2xl text-center">
          <p className="text-sm text-gold-deep mb-2">Chưa có danh mục nào. Vui lòng thêm danh mục trước khi tạo món.</p>
          <button onClick={() => setCatEditModal({ open: true, target: { name: '', isActive: true } })} className="btn-primary text-sm">Thêm danh mục đầu tiên</button>
        </div>
      )}
      {categories.length > 0 && (
        <details className="mt-4 group">
          <summary className="text-sm text-cafe-500 cursor-pointer hover:text-bean font-medium">Quản lý danh mục ({categories.length})</summary>
          <div className="mt-2 space-y-1.5">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-xl border border-line shadow-soft">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{c.name}</span>
                  {!c.isActive && <span className="badge-inactive text-xs">Ẩn</span>}
                  {c.description && <span className="text-xs text-cafe-400">— {c.description}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCatEditModal({ open: true, target: { id: c.id, name: c.name, description: c.description, isActive: c.isActive } })} className="p-1 text-cafe-400 hover:text-cafe-700"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleCatDelete(c.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      </>)}
    </div>
  );
}
