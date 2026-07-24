'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import LockedButton from '@/components/ui/LockedButton';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge, { tableStatusTone } from '@/components/user/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { tableService } from '@/services';
import { canManage, packageLimits } from '@/lib/permission';
import { formatTableStatus } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import type { CafeTable, TableStatus } from '@/types';
import { Plus, Pencil, Trash2, Eye, RotateCcw, AlertCircle, Grid3X3 } from 'lucide-react';

const statusOptions: { value: TableStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'empty', label: 'Trống' },
  { value: 'serving', label: 'Đang phục vụ' },
];

const formStatusOptions: { value: TableStatus; label: string }[] = [
  { value: 'empty', label: 'Trống' },
  { value: 'serving', label: 'Đang phục vụ' },
];

export default function TablesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TableStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<CafeTable | null>(null);
  const [editTarget, setEditTarget] = useState<CafeTable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CafeTable | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CafeTable>>({ name: '', capacity: 4, status: 'empty' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    tableService.list().then(setTables).catch(() => { setError(true); toast({ description: 'Không thể tải danh sách bàn', variant: 'destructive' }); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = tables.filter(t =>
    (filterStatus === 'all' || t.status === filterStatus) &&
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    all: tables.length,
    empty: tables.filter(t => t.status === 'empty').length,
    serving: tables.filter(t => t.status === 'serving').length,
  };

  // Giới hạn theo gói (Pro: tối đa 10 bàn; Free/Pro Max: không giới hạn).
  // Chỉ áp cho gói có quyền chỉnh sửa & có trần hữu hạn (Pro) — bỏ qua 'none'.
  const limits = packageLimits(user?.subscription);
  const managable = canManage(user?.subscription);
  const hasTableCap = managable && Number.isFinite(limits.maxTables);
  const atTableLimit = hasTableCap && tables.length >= limits.maxTables;

  const resetFilters = () => { setSearch(''); setFilterStatus('all'); };
  const openAdd = () => { setEditTarget(null); setForm({ name: '', capacity: 4, status: 'empty' }); setModalOpen(true); };
  const openEdit = (t: CafeTable) => { setEditTarget(t); setForm({ ...t }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name) return;
    if (!editTarget && atTableLimit) {
      toast({ description: `Gói Pro chỉ cho phép tối đa ${limits.maxTables} bàn. Nâng cấp lên Pro Max để thêm không giới hạn.`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await tableService.update(editTarget.id, form);
        setTables(prev => prev.map(t => t.id === editTarget.id ? updated : t));
        toast({ description: 'Đã cập nhật bàn' });
      } else {
        const created = await tableService.create(form);
        setTables(prev => [...prev, created]);
        toast({ description: 'Đã thêm bàn mới' });
      }
      setModalOpen(false);
    } catch {
      toast({ description: 'Lưu thất bại', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await tableService.remove(deleteTarget.id);
      setTables(prev => prev.filter(t => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ description: 'Đã xóa bàn' });
    } catch {
      toast({ description: 'Xóa thất bại', variant: 'destructive' });
    }
  };

  return (
    <div>
      <PageHeader title="Quản lý bàn" description="Theo dõi và cập nhật trạng thái bàn trong quán."
        actions={
          <div className="flex items-center gap-3">
            {hasTableCap && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${atTableLimit ? 'bg-red-50 text-red-600 border-red-200' : 'bg-sand text-cafe-600 border-line'}`}>
                {tables.length}/{limits.maxTables} bàn
              </span>
            )}
            <button onClick={openAdd} disabled={atTableLimit || !managable}
              title={!managable ? 'Gói đã hết hạn — chỉ có thể xem' : atTableLimit ? `Gói Pro tối đa ${limits.maxTables} bàn — nâng cấp Pro Max để không giới hạn` : undefined}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"><Plus className="w-4 h-4" />Thêm bàn</button>
          </div>
        }
      />

      {loading && <LoadingSkeleton variant="table" rows={6} cols={5} />}
      {error && !loading && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4 mb-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải danh sách bàn.</span></div>}
      {!loading && !error && (<>
      {atTableLimit && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Bạn đã đạt giới hạn {limits.maxTables} bàn của gói Pro. <a href="/user/subscription" className="font-semibold underline">Nâng cấp Pro Max</a> để thêm bàn không giới hạn.</span>
        </div>
      )}
      {/* Tổng quan nhanh */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl bg-white border border-line p-4 shadow-soft">
          <p className="text-2xl font-bold text-ink">{counts.all}</p>
          <p className="text-xs text-cafe-500 mt-0.5">Tổng số bàn</p>
        </div>
        <div className="rounded-2xl bg-pine/8 border border-pine/15 p-4">
          <p className="text-2xl font-bold text-pine">{counts.empty}</p>
          <p className="text-xs text-pine/80 mt-0.5">Bàn trống</p>
        </div>
        <div className="rounded-2xl bg-gold/12 border border-gold/25 p-4">
          <p className="text-2xl font-bold text-gold-deep">{counts.serving}</p>
          <p className="text-xs text-gold-deep/80 mt-0.5">Đang phục vụ</p>
        </div>
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm bàn..." />
        <select className="input-funcafe !w-auto min-w-[150px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value as TableStatus | 'all')}>
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={resetFilters} className="btn-secondary"><RotateCcw className="w-3.5 h-3.5" />Đặt lại</button>
      </FilterBar>

      <div className="bg-white rounded-2xl border border-line overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-sand border-b border-line">
            <tr>
              <th className="text-left px-5 py-3 text-cafe-600 font-semibold">Tên bàn</th>
              <th className="text-left px-5 py-3 text-cafe-600 font-semibold">Sức chứa</th>
              <th className="text-left px-5 py-3 text-cafe-600 font-semibold">Trạng thái</th>
              <th className="text-left px-5 py-3 text-cafe-600 font-semibold">Order hiện tại</th>
              <th className="text-right px-5 py-3 text-cafe-600 font-semibold">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-sand/50 transition-colors">
                <td className="px-5 py-3 font-semibold text-ink">{t.name}</td>
                <td className="px-5 py-3 text-cafe-600">{t.capacity} người</td>
                <td className="px-5 py-3"><StatusBadge tone={tableStatusTone[t.status]}>{formatTableStatus(t.status)}</StatusBadge></td>
                <td className="px-5 py-3 text-cafe-500 text-xs font-mono">{t.currentOrderId ?? '—'}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setViewTarget(t)} title="Xem" className="p-2 text-cafe-400 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(t)} title="Sửa" className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                    {managable ? (
                      <button onClick={() => setDeleteTarget(t)} title="Xóa" className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    ) : (
                      <LockedButton variant="danger" className="p-2 text-xs"><Trash2 className="w-3.5 h-3.5" /></LockedButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5}>
                {tables.length === 0
                  ? <EmptyState icon={Grid3X3} title="Bạn chưa thêm bàn nào" description="Thêm bàn đầu tiên để bắt đầu theo dõi trạng thái phục vụ." />
                  : <EmptyState icon={Grid3X3} title="Không tìm thấy bàn nào" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Chi tiết bàn" size="sm">
        {viewTarget && (
          <div className="space-y-1">
            <div className="flex justify-between py-2.5 border-b border-line"><span className="text-cafe-500 text-sm">Tên bàn</span><span className="font-semibold text-ink">{viewTarget.name}</span></div>
            <div className="flex justify-between py-2.5 border-b border-line"><span className="text-cafe-500 text-sm">Sức chứa</span><span className="font-semibold text-ink">{viewTarget.capacity} người</span></div>
            <div className="flex justify-between py-2.5 border-b border-line items-center"><span className="text-cafe-500 text-sm">Trạng thái</span><StatusBadge tone={tableStatusTone[viewTarget.status]}>{formatTableStatus(viewTarget.status)}</StatusBadge></div>
            <div className="flex justify-between py-2.5"><span className="text-cafe-500 text-sm">Order hiện tại</span><span className="font-mono text-xs text-bean">{viewTarget.currentOrderId ?? '—'}</span></div>
            <button onClick={() => setViewTarget(null)} className="btn-secondary w-full mt-3">Đóng</button>
          </div>
        )}
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Chỉnh sửa bàn' : 'Thêm bàn mới'}>
        <div className="space-y-4">
          <div>
            <label className="label-funcafe">Tên bàn <span className="text-red-500">*</span></label>
            <input className="input-funcafe" placeholder="VD: Bàn 01" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label-funcafe">Sức chứa (người)</label>
            <input type="number" min={1} max={50} className="input-funcafe" value={form.capacity ?? 4} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label-funcafe">Trạng thái</label>
            <select className="input-funcafe" value={form.status ?? 'empty'} onChange={e => setForm({ ...form, status: e.target.value as TableStatus })}>
              {formStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            {managable ? (
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Đang lưu...' : editTarget ? 'Cập nhật' : 'Lưu'}</button>
            ) : (
              <LockedButton className="flex-1">{editTarget ? 'Cập nhật' : 'Lưu'}</LockedButton>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Xóa bàn" message={`Bạn có chắc muốn xóa bàn "${deleteTarget?.name}" không?`} confirmLabel="Xóa" danger loading={saving} />
      </>)}
    </div>
  );
}
