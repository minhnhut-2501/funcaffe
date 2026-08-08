'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import LockedButton from '@/components/ui/LockedButton';
import { useAuth } from '@/context/AuthContext';
import { menuService, categoryService, toppingService } from '@/services';
import { canManage, packageLimits } from '@/lib/permission';
import { formatCurrency, formatThousands, parseThousands } from '@/lib/format';
import { generateId, compareByName } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import ImageUpload from '@/components/ui/ImageUpload';
import EmptyState from '@/components/ui/EmptyState';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge from '@/components/user/StatusBadge';
import ToppingPickerModal from '@/components/user/ToppingPickerModal';
import type { MenuItem, MenuItemSize, Topping } from '@/types';
import { Plus, Pencil, Trash2, Eye, RotateCcw, FolderPlus, Image as ImageIcon, UtensilsCrossed, AlertCircle, CupSoda, ChevronRight, FolderTree } from 'lucide-react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import Pagination, { usePagination } from '@/components/ui/Pagination';

export default function MenuPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof categoryService.list>>>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [sizeFilter, setSizeFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [toppingFilter, setToppingFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<MenuItem | null>(null);
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toppingPickerOpen, setToppingPickerOpen] = useState(false);
  const [catEditModal, setCatEditModal] = useState<{ open: boolean; target?: { id?: string; name: string; description?: string; isActive: boolean } }>({ open: false, target: { name: '', isActive: true } });
  // Danh mục tách hẳn thành một tab thay vì khối thu gọn cuối trang: đó là nơi
  // duy nhất sửa và ẩn/hiện được danh mục, mà lại là chỗ khó thấy nhất.
  const [tab, setTab] = useState<'items' | 'categories'>('items');

  const load = () => {
    setLoading(true);
    Promise.all([
      menuService.list().then(setItems),
      categoryService.list().then(setCategories),
      toppingService.list().then(setToppings),
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
  ).sort((a, b) => compareByName(a.name, b.name));

  // Cắt trang SAU khi đã lọc và tìm kiếm, không phải trước.
  const itemPaging = usePagination(filtered);
  const catPaging = usePagination(categories);

  // Giới hạn theo gói (Pro: tối đa 15 món; Free/Pro Max: không giới hạn).
  // Chỉ áp cho gói có quyền chỉnh sửa & có trần hữu hạn (Pro) — bỏ qua 'none'.
  const limits = packageLimits(user?.subscription);
  const managable = canManage(user?.subscription);
  const hasItemCap = managable && Number.isFinite(limits.maxMenuItems);
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

  // Món KHÔNG xóa được (đã nằm trong order/hóa đơn cũ) — chỉ ẩn/mở bán lại.
  const handleToggleAvailable = async (item: MenuItem) => {
    try {
      const updated = await menuService.update(item.id, { isAvailable: !item.isAvailable });
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
      toast({ description: updated.isAvailable ? `Đã mở bán lại "${item.name}"` : `Đã ẩn "${item.name}" khỏi thực đơn bán hàng` });
    } catch {
      toast({ description: 'Cập nhật thất bại', variant: 'destructive' });
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

  const toggleTopping = (id: string) => {
    setForm(f => {
      const cur = f.allowedToppingIds ?? [];
      return { ...f, allowedToppingIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    });
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
  // Danh mục KHÔNG xóa được (xóa sẽ bỏ rơi món bên trong) — chỉ ẩn/hiện.
  const handleCatToggle = async (c: { id: string; name: string; isActive: boolean }) => {
    try {
      await categoryService.update(c.id, { is_active: !c.isActive });
      await categoryService.list().then(setCategories);
      toast({ description: !c.isActive ? `Đã hiển thị lại danh mục "${c.name}"` : `Đã ẩn danh mục "${c.name}"` });
    } catch { toast({ description: 'Cập nhật danh mục thất bại', variant: 'destructive' }); }
  };

  return (
    <div>
      <PageHeader title="Thực đơn" description="Quản lý món, giá bán, size và topping của quán."
        actions={<div className="flex items-center gap-2">
          {/* Nút đổi theo tab đang mở — hiện cả hai cùng lúc thì rối và dễ bấm nhầm. */}
          {tab === 'items' ? (<>
            {hasItemCap && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${atItemLimit ? 'bg-red-50 text-red-600 border-red-200' : 'bg-sand text-cafe-600 border-line'}`}>
                {items.length}/{limits.maxMenuItems} món
              </span>
            )}
            <button onClick={openAdd} disabled={atItemLimit || !managable}
              title={!managable ? 'Gói đã hết hạn — chỉ có thể xem' : atItemLimit ? `Gói Pro tối đa ${limits.maxMenuItems} món — nâng cấp Pro Max để không giới hạn` : undefined}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Plus className="w-4 h-4" />Thêm món</button>
          </>) : (
            <button onClick={() => setCatEditModal({ open: true, target: { name: '', isActive: true } })} disabled={!managable}
              title={!managable ? 'Gói đã hết hạn — chỉ có thể xem' : undefined}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><FolderPlus className="w-4 h-4" />Thêm danh mục</button>
          )}
        </div>} />

      {loading && <LoadingSkeleton variant="table" rows={6} cols={5} />}
      {!loading && (<>

      <div className="flex gap-1 border-b border-line mb-6">
        <button onClick={() => setTab('items')}
          className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 ${tab === 'items' ? 'border-bean text-bean font-semibold' : 'border-transparent text-cafe-500 hover:text-ink font-medium'}`}>
          <UtensilsCrossed className="w-4 h-4" />Món ăn
          {items.length > 0 && <span className="text-[11px] font-semibold bg-sand text-cafe-500 rounded-full px-1.5">{items.length}</span>}
        </button>
        <button onClick={() => setTab('categories')}
          className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 ${tab === 'categories' ? 'border-bean text-bean font-semibold' : 'border-transparent text-cafe-500 hover:text-ink font-medium'}`}>
          <FolderTree className="w-4 h-4" />Danh mục
          {categories.length > 0 && <span className="text-[11px] font-semibold bg-sand text-cafe-500 rounded-full px-1.5">{categories.length}</span>}
        </button>
      </div>

      {/* ===== Tab: Món ăn ===== */}
      {tab === 'items' && (<>

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

      {/* Mobile: giao diện thẻ thay cho bảng cứng để không phải cuộn ngang trên màn hẹp */}
      <div className="stagger md:hidden space-y-2.5">
        {itemPaging.pageRows.map(item => {
          const minPrice = item.hasSize && item.sizes.length > 0
            ? Math.min(...item.sizes.filter(s => s.isActive).map(s => s.price))
            : item.basePrice;
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-line shadow-soft p-3.5">
              <div className="flex gap-3">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover border border-line shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-sand border border-line flex items-center justify-center text-cafe-300 shrink-0"><ImageIcon className="w-5 h-5" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink text-sm leading-snug truncate">{item.name}</p>
                    <StatusBadge tone={item.isAvailable ? 'success' : 'neutral'} className="shrink-0">{item.isAvailable ? 'Đang bán' : 'Hết món'}</StatusBadge>
                  </div>
                  <p className="text-xs text-cafe-500 mt-0.5">{getCatName(item.categoryId)}</p>
                  <p className="text-sm font-semibold text-bean mt-1">{item.hasSize ? `Từ ${formatCurrency(minPrice)}` : formatCurrency(item.basePrice)}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    {item.hasSize && <span className="badge-free text-[10px]">Có size</span>}
                    {item.allowTopping && <span className="badge-pro text-[10px]">Topping</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 mt-2.5 pt-2.5 border-t border-line/60">
                <button onClick={() => setViewTarget(item)} title="Xem" className="p-3 text-cafe-400 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                <button onClick={() => openEdit(item)} title="Sửa" className="p-3 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                {/* Ẩn/hiện viết thành CHỮ chứ không dùng con mắt gạch chéo: ngay bên
                    trái đã có nút Xem mang icon con mắt, hai glyph mắt cạnh nhau ở cỡ
                    16px nhìn như lặp lại. Chữ nói thẳng ra hành động sẽ xảy ra. */}
                {managable ? (
                  <button onClick={() => handleToggleAvailable(item)}
                    title={item.isAvailable ? 'Ẩn món (ngừng bán)' : 'Mở bán lại'}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${item.isAvailable ? 'border-line text-cafe-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50' : 'border-pine/30 text-pine hover:bg-pine/12'}`}>
                    {item.isAvailable ? 'Ẩn' : 'Hiện'}
                  </button>
                ) : (
                  <LockedButton className="px-3 py-2 text-xs">Ẩn</LockedButton>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          items.length === 0
            ? <EmptyState icon={UtensilsCrossed} title="Bạn chưa thêm món nào" description="Thêm món đầu tiên vào thực đơn để bắt đầu bán hàng." />
            : <EmptyState icon={UtensilsCrossed} title="Không tìm thấy món nào" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />
        )}
      </div>

      <div className="hidden md:block bg-white rounded-2xl border border-line overflow-x-auto shadow-soft">
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
          <tbody className="stagger divide-y divide-line/70">
            {itemPaging.pageRows.map(item => {
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
                      {managable ? (
                        <button onClick={() => handleToggleAvailable(item)}
                          title={item.isAvailable ? 'Ẩn món (ngừng bán)' : 'Mở bán lại'}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${item.isAvailable ? 'border-line text-cafe-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50' : 'border-pine/30 text-pine hover:bg-pine/12'}`}>
                          {item.isAvailable ? 'Ẩn' : 'Hiện'}
                        </button>
                      ) : (
                        <LockedButton className="px-2.5 py-1.5 text-xs">Ẩn</LockedButton>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8}>
                {items.length === 0
                  ? <EmptyState icon={UtensilsCrossed} title="Bạn chưa thêm món nào" description="Thêm món đầu tiên vào thực đơn để bắt đầu bán hàng." />
                  : <EmptyState icon={UtensilsCrossed} title="Không tìm thấy món nào" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={itemPaging.page} lastPage={itemPaging.lastPage} total={itemPaging.total}
        onChange={itemPaging.setPage} unit="món" />

      </>)}

      {/* ===== Tab: Danh mục ===== */}
      {tab === 'categories' && (
        categories.length === 0 ? (
          <EmptyState icon={FolderTree} title="Chưa có danh mục nào"
            description="Danh mục giúp nhóm các món lại với nhau, ví dụ Cà phê, Trà sữa, Bánh ngọt. Thêm danh mục trước khi tạo món." />
        ) : (<>
          <div className="space-y-1.5">
            {catPaging.pageRows.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-xl border border-line shadow-soft">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-ink truncate">{c.name}</span>
                  {!c.isActive && <span className="badge-inactive text-xs shrink-0">Ẩn</span>}
                  {c.description && <span className="text-xs text-cafe-400 truncate">— {c.description}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-cafe-400 mr-2">{items.filter(i => i.categoryId === c.id).length} món</span>
                  {managable ? (<>
                    <button onClick={() => setCatEditModal({ open: true, target: { id: c.id, name: c.name, description: c.description, isActive: c.isActive } })}
                      title="Sửa danh mục" className="p-2 text-cafe-400 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleCatToggle(c)}
                      title={c.isActive ? 'Ẩn danh mục' : 'Hiển thị lại'}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${c.isActive ? 'border-line text-cafe-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50' : 'border-pine/30 text-pine hover:bg-pine/12'}`}>
                      {c.isActive ? 'Ẩn' : 'Hiện'}
                    </button>
                  </>) : (
                    <LockedButton className="px-2.5 py-1.5 text-xs">Ẩn</LockedButton>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination page={catPaging.page} lastPage={catPaging.lastPage} total={catPaging.total}
            onChange={catPaging.setPage} unit="danh mục" />

          <p className="text-xs text-cafe-400 mt-4">
            Danh mục chỉ ẩn được chứ không xóa — xóa sẽ làm các món bên trong mất nhóm.
          </p>
        </>)
      )}

      {/* View Modal */}
      <Modal
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title="Chi tiết món"
        size="md"
        footer={<button onClick={() => setViewTarget(null)} className="btn-secondary w-full">Đóng</button>}
      >
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
            <div className="flex justify-between py-2 border-b border-cafe-50"><span className="text-cafe-500">Cho phép topping</span><span>{viewTarget.allowTopping ? 'Có' : 'Không'}</span></div>
            {viewTarget.allowTopping && (viewTarget.allowedToppingIds?.length ?? 0) > 0 && (
              <div className="py-2">
                <span className="text-cafe-500">Topping đã chọn</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {viewTarget.allowedToppingIds!.map(id => {
                    const t = toppings.find(x => x.id === id);
                    if (!t) return null;
                    return <span key={id} className="inline-flex items-center gap-1 text-xs bg-bean-tint text-bean font-medium px-2.5 py-1 rounded-full">{t.name} · {formatCurrency(t.price)}</span>;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Chỉnh sửa món' : 'Thêm món mới'}
        size="lg"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            {managable ? (
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Đang lưu...' : editTarget ? 'Cập nhật' : 'Lưu'}</button>
            ) : (
              <LockedButton className="flex-1">{editTarget ? 'Cập nhật' : 'Lưu'}</LockedButton>
            )}
          </div>
        }
      >
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
              <input type="text" inputMode="numeric" className="input-funcafe" placeholder="0"
                value={formatThousands(form.basePrice ?? 0)}
                onChange={e => setForm({ ...form, basePrice: parseThousands(e.target.value) })} />
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

          {form.allowTopping && (() => {
            const selIds = form.allowedToppingIds ?? [];
            const selected = toppings.filter(t => selIds.includes(t.id));
            return (
              <div>
                <label className="label-funcafe flex items-center gap-1.5"><CupSoda className="w-4 h-4 text-bean" />Topping cho món này</label>
                {toppings.length === 0 ? (
                  <p className="text-sm text-cafe-500 bg-sand/40 border border-line rounded-xl px-4 py-3">
                    Quán chưa có topping nào.{' '}
                    <a href="/user/toppings" className="text-bean font-semibold hover:underline">Thêm topping</a> rồi quay lại chọn.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setToppingPickerOpen(true)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 hover:border-bean hover:bg-bean-tint/30 transition-colors text-left"
                  >
                    {selected.length === 0 ? (
                      <span className="text-sm text-cafe-400">Chưa chọn topping — bấm để chọn</span>
                    ) : (
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="flex -space-x-2">
                          {selected.slice(0, 4).map(t => (
                            <span key={t.id} className="w-7 h-7 rounded-full ring-2 ring-white bg-sand overflow-hidden flex items-center justify-center">
                              {t.imageUrl ? <img src={t.imageUrl} alt="" className="w-full h-full object-cover" /> : <CupSoda className="w-3.5 h-3.5 text-cafe-300" />}
                            </span>
                          ))}
                        </span>
                        <span className="text-sm font-medium text-ink truncate">Đã chọn {selected.length} topping</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-sm font-semibold text-bean shrink-0">{selected.length ? 'Chọn lại' : 'Chọn'}<ChevronRight className="w-4 h-4" /></span>
                  </button>
                )}
              </div>
            );
          })()}

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
                      <input type="text" inputMode="numeric" className="input-funcafe" placeholder="Giá (đ)"
                        value={formatThousands(sz.price)} onChange={e => updateSize(idx, 'price', parseThousands(e.target.value))} />
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
        </div>
      </Modal>

      {/* Popup chọn topping (nổi trên modal thêm/sửa món) */}
      <ToppingPickerModal
        open={toppingPickerOpen}
        onClose={() => setToppingPickerOpen(false)}
        toppings={toppings}
        selectedIds={form.allowedToppingIds ?? []}
        onToggle={toggleTopping}
      />

      {/* Category Edit Modal */}
      <Modal
        open={catEditModal.open}
        onClose={() => setCatEditModal({ open: false, target: { name: '', isActive: true } })}
        title={catEditModal.target?.id ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}
        size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setCatEditModal({ open: false, target: { name: '', isActive: true } })} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleCatSave} className="btn-primary flex-1">{catEditModal.target?.id ? 'Cập nhật' : 'Thêm'}</button>
          </div>
        }
      >
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
        </div>
      </Modal>

      {/* Nhắc ở tab Món: chưa có danh mục thì không tạo món được. Tab Danh mục đã có
          màn hình rỗng riêng nên không cần nhắc lại. */}
      {tab === 'items' && categories.length === 0 && (
        <div className="mt-4 p-4 bg-gold/10 border border-gold/25 rounded-2xl text-center">
          <p className="text-sm text-gold-deep mb-2">Chưa có danh mục nào. Vui lòng thêm danh mục trước khi tạo món.</p>
          <button onClick={() => setTab('categories')} className="btn-primary text-sm">Thêm danh mục đầu tiên</button>
        </div>
      )}
      </>)}
    </div>
  );
}
