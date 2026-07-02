'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { packageService, timeSubscriptionService } from '@/services';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import type { Package, TimeSubscription } from '@/types';
import { Check, X, Pencil, Plus, Trash2, AlertCircle } from 'lucide-react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/user/StatusBadge';

export default function AdminPackagesPage() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [editTarget, setEditTarget] = useState<Package | null>(null);
  const [form, setForm] = useState<Partial<Package>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Time subscription state inside modal
  const [timeSubs, setTimeSubs] = useState<TimeSubscription[]>([]);
  const [tsModal, setTsModal] = useState(false);
  const [tsEdit, setTsEdit] = useState<TimeSubscription | null>(null);
  const [tsForm, setTsForm] = useState<{ duration_value: number; duration_unit: 'day' | 'month'; price: number; label: string; status: 'active' | 'inactive' }>({ duration_value: 1, duration_unit: 'month', price: 0, label: '', status: 'active' });
  const [tsDelete, setTsDelete] = useState<TimeSubscription | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPackages = () => {
    setLoading(true);
    packageService.list().then(setPackages).catch(() => setError(true)).finally(() => setLoading(false));
  };
  useEffect(() => { loadPackages(); }, []);

  const openEdit = (pkg: Package) => {
    setEditTarget(pkg);
    setForm(pkg);
    setTimeSubs([]);
    timeSubscriptionService.listByPackage(pkg.id).then(setTimeSubs).catch(() => toast({ description: 'Không thể tải thời hạn', variant: 'destructive' }));
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await packageService.update(editTarget.id, form);
      setPackages(prev => prev.map(p => p.id === editTarget.id ? { ...p, ...form } as Package : p));
      toast({ description: 'Đã cập nhật gói dịch vụ' });
    } catch {
      toast({ description: 'Cập nhật thất bại', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Time Subscription handlers
  const openTsAdd = () => {
    setTsEdit(null);
    setTsForm({ duration_value: 1, duration_unit: 'month', price: 0, label: '', status: 'active' });
    setTsModal(true);
  };

  const openTsEdit = (ts: TimeSubscription) => {
    setTsEdit(ts);
    setTsForm({ duration_value: ts.durationValue, duration_unit: ts.durationUnit, price: ts.price, label: ts.label, status: ts.status });
    setTsModal(true);
  };

  const handleTsSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      if (tsEdit) {
        await timeSubscriptionService.update(tsEdit.id, tsForm);
        setTimeSubs(prev => prev.map(t => t.id === tsEdit.id ? {
          ...t,
          durationValue: tsForm.duration_value,
          durationUnit: tsForm.duration_unit,
          price: tsForm.price,
          label: tsForm.label,
          status: tsForm.status,
        } : t));
        toast({ description: 'Đã cập nhật thời hạn' });
      } else {
        const raw = await timeSubscriptionService.create({ package_id: editTarget.id, ...tsForm });
        const newTs: TimeSubscription = {
          id: raw.id ?? raw._id,
          packageId: editTarget.id,
          durationValue: tsForm.duration_value,
          durationUnit: tsForm.duration_unit,
          price: tsForm.price,
          label: tsForm.label,
          status: tsForm.status,
        };
        setTimeSubs(prev => [...prev, newTs]);
        toast({ description: 'Đã thêm thời hạn mới' });
      }
      setTsModal(false);
    } catch {
      toast({ description: 'Thao tác thất bại', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTsDelete = async () => {
    if (!tsDelete) return;
    setSaving(true);
    try {
      await timeSubscriptionService.delete(tsDelete.id);
      setTimeSubs(prev => prev.filter(t => t.id !== tsDelete.id));
      setTsDelete(null);
      toast({ description: 'Đã xoá thời hạn' });
    } catch {
      toast({ description: 'Xoá thất bại', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Gói dịch vụ" description="Quản lý cấu hình các gói dịch vụ và thời hạn" />

      {loading && <LoadingSkeleton variant="card" rows={3} />}
      {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải gói dịch vụ.</span></div>}
      {!loading && !error && packages.length === 0 && <EmptyState title="Chưa có gói dịch vụ" />}

      {!loading && !error && packages.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map(pkg => {
          const highlight = pkg.type === 'promax';
          return (
          <div
            key={pkg.id}
            className={`relative flex flex-col h-full rounded-2xl border p-6 pt-7 bg-white shadow-soft transition-shadow hover:shadow-card ${
              highlight ? 'border-bean ring-2 ring-bean/20' : 'border-line'
            }`}
          >
            {/* Thanh accent + chip nổi bật cho gói Pro Max */}
            {highlight && (
              <>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl bg-gradient-to-r from-bean to-bean-dark" />
                <span className="absolute -top-3 right-6 inline-flex items-center rounded-full bg-bean px-3 py-1 text-[11px] font-semibold text-white shadow-sm">Phổ biến nhất</span>
              </>
            )}

            {/* Header: tên + trạng thái + nút sửa */}
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-ink truncate">{pkg.name}</h3>
                <div className="mt-1.5">
                  <StatusBadge tone={pkg.isActive ? 'success' : 'neutral'}>{pkg.isActive ? 'Đang hiển thị' : 'Ẩn'}</StatusBadge>
                </div>
              </div>
              <button onClick={() => openEdit(pkg)} aria-label={`Chỉnh sửa gói ${pkg.name}`} className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors shrink-0">
                <Pencil className="w-4 h-4" />
              </button>
            </div>

            {/* Slot giá — cùng chiều cao mọi card */}
            <div className="mb-4 min-h-[3.5rem]">
              {pkg.isTrial ? (
                <>
                  <span className="text-2xl font-bold text-bean">Miễn phí</span>
                  <p className="text-xs text-cafe-500 mt-0.5">Dùng thử 7 ngày</p>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold text-ink">Theo thời hạn</span>
                  <p className="text-xs text-cafe-500 mt-0.5">Cấu hình giá trong phần chỉnh sửa</p>
                </>
              )}
            </div>

            {pkg.description && <p className="text-sm text-cafe-500 mb-4 line-clamp-2">{pkg.description}</p>}

            {/* Danh sách tính năng — co giãn để đẩy footer xuống đáy */}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cafe-400 mb-2">Bao gồm</p>
            <ul className="space-y-2 flex-1">
              {pkg.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-cafe-600">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-pine/12 grid place-items-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-pine" />
                  </span>
                  <span className="leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            {/* Footer meta — pill đều nhau, ghim đáy */}
            <div className="mt-5 pt-4 border-t border-line flex flex-wrap gap-2">
              <MetaPill ok={pkg.canUseAI ?? false} label={pkg.canUseAI ? 'Có trợ lý AI' : 'Chưa có AI'} />
              <MetaPill ok={pkg.isTrial} label={pkg.isTrial ? 'Có dùng thử' : 'Không dùng thử'} />
            </div>
          </div>
          );
        })}
      </div>
      )}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Chỉnh sửa gói: ${editTarget?.name}`} size="lg">
        {editTarget && (
          <div className="space-y-6">
            {/* Package form */}
            <div className="space-y-4">
              <h3 className="font-bold text-ink text-sm uppercase tracking-wider">Thông tin gói</h3>
              <div>
                <label className="label-funcafe">Tên gói</label>
                <input className="input-funcafe" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label-funcafe">Mô tả</label>
                <textarea rows={2} className="input-funcafe resize-none" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-cafe-700 cursor-pointer">
                <input type="checkbox" checked={form.isActive ?? true} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                Hiển thị gói này cho khách hàng
              </label>
              <label className="flex items-center gap-2 text-sm text-cafe-700 cursor-pointer">
                <input type="checkbox" checked={form.canUseAI ?? false} onChange={e => setForm({ ...form, canUseAI: e.target.checked })} />
                Có trợ lý AI (sắp ra mắt)
              </label>

              {/* Giới hạn tài nguyên — null = không giới hạn */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="label-funcafe">Số bàn tối đa</label>
                  <input type="number" min={1} className="input-funcafe" placeholder="Không giới hạn"
                    disabled={form.maxTables == null}
                    value={form.maxTables ?? ''}
                    onChange={e => setForm({ ...form, maxTables: e.target.value === '' ? null : Number(e.target.value) })} />
                  <label className="flex items-center gap-1.5 text-xs text-cafe-600 mt-1.5 cursor-pointer">
                    <input type="checkbox" checked={form.maxTables == null}
                      onChange={e => setForm({ ...form, maxTables: e.target.checked ? null : 10 })} />
                    Không giới hạn
                  </label>
                </div>
                <div>
                  <label className="label-funcafe">Số món tối đa</label>
                  <input type="number" min={1} className="input-funcafe" placeholder="Không giới hạn"
                    disabled={form.maxMenuItems == null}
                    value={form.maxMenuItems ?? ''}
                    onChange={e => setForm({ ...form, maxMenuItems: e.target.value === '' ? null : Number(e.target.value) })} />
                  <label className="flex items-center gap-1.5 text-xs text-cafe-600 mt-1.5 cursor-pointer">
                    <input type="checkbox" checked={form.maxMenuItems == null}
                      onChange={e => setForm({ ...form, maxMenuItems: e.target.checked ? null : 15 })} />
                    Không giới hạn
                  </label>
                </div>
              </div>
              <p className="text-xs text-cafe-400 italic">Giá gói được quản lý qua mục "Quản lý thời hạn" bên dưới.</p>
            </div>

            {/* Time Subscriptions section */}
            <div className="border-t border-line pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-ink text-sm uppercase tracking-wider">Quản lý thời hạn</h3>
                <button onClick={openTsAdd} className="text-xs btn-primary py-1.5"><Plus className="w-3.5 h-3.5" />Thêm</button>
              </div>
              {timeSubs.length === 0 ? (
                <p className="text-sm text-cafe-400">Chưa có thời hạn nào. Nhấn "Thêm" để tạo mới.</p>
              ) : (
                <div className="bg-white rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-sand border-b border-line">
                      <tr>
                        <th className="text-left px-3 py-2 text-cafe-600 font-semibold text-xs">Nhãn</th>
                        <th className="text-right px-3 py-2 text-cafe-600 font-semibold text-xs">Giá trị</th>
                        <th className="text-left px-3 py-2 text-cafe-600 font-semibold text-xs">Đơn vị</th>
                        <th className="text-right px-3 py-2 text-cafe-600 font-semibold text-xs">Giá</th>
                        <th className="text-left px-3 py-2 text-cafe-600 font-semibold text-xs">Trạng thái</th>
                        <th className="text-right px-3 py-2 text-cafe-600 font-semibold text-xs">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/70">
                      {timeSubs.map(t => (
                        <tr key={t.id} className="hover:bg-sand/50 transition-colors">
                          <td className="px-3 py-2 font-semibold text-ink">{t.label}</td>
                          <td className="px-3 py-2 text-right text-cafe-700">{t.durationValue}</td>
                          <td className="px-3 py-2 text-cafe-600">{t.durationUnit === 'month' ? 'Tháng' : 'Ngày'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-bean">{formatCurrency(t.price)}</td>
                          <td className="px-3 py-2"><StatusBadge tone={t.status === 'active' ? 'success' : 'neutral'}>{t.status === 'active' ? 'Đang dùng' : 'Ẩn'}</StatusBadge></td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => openTsEdit(t)} className="p-1.5 text-cafe-400 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setTsDelete(t)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-line">
              <button onClick={() => setEditTarget(null)} className="btn-secondary flex-1">Hủy</button>
              <button onClick={handleSave} className="btn-primary flex-1" disabled={saving}>Lưu thay đổi</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Time Subscription add/edit modal */}
      <Modal open={tsModal} onClose={() => setTsModal(false)} title={tsEdit ? 'Chỉnh sửa thời hạn' : 'Thêm thời hạn'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label-funcafe">Nhãn hiển thị</label>
            <input className="input-funcafe" placeholder="VD: 1 tháng" value={tsForm.label} onChange={e => setTsForm({ ...tsForm, label: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-funcafe">Giá trị</label>
              <input type="number" min={1} className="input-funcafe" value={tsForm.duration_value} onChange={e => setTsForm({ ...tsForm, duration_value: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label-funcafe">Đơn vị</label>
              <select className="input-funcafe" value={tsForm.duration_unit} onChange={e => setTsForm({ ...tsForm, duration_unit: e.target.value as 'day' | 'month' })}>
                <option value="month">Tháng</option>
                <option value="day">Ngày</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label-funcafe">Giá (đ)</label>
            <input type="number" min={0} className="input-funcafe" value={tsForm.price} onChange={e => setTsForm({ ...tsForm, price: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-cafe-700 cursor-pointer">
            <input type="checkbox" checked={tsForm.status === 'active'} onChange={e => setTsForm({ ...tsForm, status: e.target.checked ? 'active' : 'inactive' })} />
            Đang hiển thị
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setTsModal(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleTsSave} className="btn-primary flex-1" disabled={saving}>Lưu</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!tsDelete}
        onClose={() => setTsDelete(null)}
        onConfirm={handleTsDelete}
        title="Xoá thời hạn"
        message={`Xoá thời hạn "${tsDelete?.label}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá"
        danger
        loading={saving}
      />
    </div>
  );
}

/** Pill trạng thái có/không (doanh thu, dùng thử) — đồng nhất giữa các card gói. */
function MetaPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${ok ? 'bg-pine/10 text-pine' : 'bg-cafe-100 text-cafe-500'}`}>
      {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {label}
    </span>
  );
}
