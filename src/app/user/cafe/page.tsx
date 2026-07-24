'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import MediaUploader from '@/components/ui/MediaUploader';
import { useAuth } from '@/context/AuthContext';
import { cafeService, createCafe, revenueService, type RevenueOverview } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import type { CafeInfo } from '@/types';
import { VN_BANKS } from '@/lib/banks';
import {
  MapPin, Store, Pencil, Landmark,
  Plus, Check, ArrowLeft, DollarSign, CalendarDays, TrendingUp, CreditCard, Wallet,
} from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  open: { label: 'Đang mở cửa', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  closed: { label: 'Đã đóng cửa', cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  inactive: { label: 'Ngừng hoạt động', cls: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const emptyForm: CafeInfo = { id: '', name: '', address: '', phone: '', description: '', status: 'open' };

type Mode = 'list' | 'edit';

export default function CafePage() {
  const { cafes, activeCafeId, setActiveCafe, reloadCafes } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>('list');
  const [creating, setCreating] = useState(false); // edit-mode: đang tạo quán mới?
  const [form, setForm] = useState<CafeInfo>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(() => {
    revenueService.overview().then(setOverview).catch(() => setOverview(null));
  }, []);

  useEffect(() => {
    // Chưa có quán nào -> vào thẳng form tạo quán đầu tiên.
    if (cafes.length === 0) {
      setForm(emptyForm);
      setCreating(true);
      setMode('edit');
      setLoading(false);
      return;
    }
    loadOverview();
    setLoading(false);
  }, [cafes.length, loadOverview]);

  // Bản đồ doanh thu/gói theo cafeId để render thẻ.
  const revByCafe = useMemo(() => {
    const m: Record<string, RevenueOverview['cafes'][number]> = {};
    (overview?.cafes ?? []).forEach((c) => { m[c.cafeId] = c; });
    return m;
  }, [overview]);

  const openCreate = () => {
    setForm(emptyForm);
    setCreating(true);
    setMode('edit');
  };

  const openEdit = async (cafe: CafeInfo) => {
    // Đặt quán đang chọn = quán sửa để cafeService.update trỏ đúng.
    if (cafe.id !== activeCafeId) await setActiveCafe(cafe.id);
    setForm(cafe);
    setCreating(false);
    setMode('edit');
  };

  const handleSelect = async (cafe: CafeInfo) => {
    if (cafe.id === activeCafeId) return;
    await setActiveCafe(cafe.id);
    toast({ description: `Đang quản lý quán "${cafe.name}"` });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (creating) {
        await createCafe({ name: form.name, address: form.address, phone: form.phone });
        await reloadCafes();
        loadOverview();
        setMode('list');
        toast({ description: 'Đã tạo quán mới. Hãy mua gói để bắt đầu bán hàng.' });
      } else {
        await cafeService.update(form);
        await reloadCafes();
        setMode('list');
        toast({ description: 'Đã cập nhật thông tin quán' });
      }
    } catch {
      toast({ description: creating ? 'Tạo quán thất bại' : 'Lưu thất bại', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-cafe-400">Đang tải...</div>;

  // ---- EDIT / CREATE FORM ----
  if (mode === 'edit') {
    return (
      <div>
        <PageHeader
          title={creating ? 'Tạo quán mới' : 'Chỉnh sửa quán'}
          description={creating ? 'Nhập thông tin quán để thêm vào tài khoản của bạn' : 'Cập nhật thông tin cơ bản của quán'}
          actions={cafes.length > 0 ? (
            <button onClick={() => setMode('list')} className="btn-secondary"><ArrowLeft className="w-4 h-4" />Quay lại</button>
          ) : null}
        />

        {creating && cafes.length === 0 && (
          <div className="bg-bean-tint border border-line rounded-2xl p-4 mb-6 text-sm text-ink/80">
            <p className="font-semibold text-bean">Chào mừng bạn đến với FunCafe!</p>
            <p className="mt-1">Tạo quán đầu tiên để bắt đầu. Sau khi tạo, hãy mua gói dịch vụ cho quán để mở khóa bán hàng.</p>
          </div>
        )}

        <div className={creating ? 'max-w-2xl' : 'max-w-5xl'}>
          <form onSubmit={handleSave}>
            <div className={`grid gap-5 items-start ${creating ? '' : 'lg:grid-cols-5'}`}>
              {/* Thông tin cơ bản */}
              <div className={`card-funcafe ${creating ? '' : 'lg:col-span-3'}`}>
                <div className="flex items-center gap-2 pb-1 mb-5">
                  <span className="w-8 h-8 rounded-lg bg-bean-tint text-bean flex items-center justify-center"><Store className="w-4 h-4" /></span>
                  <h3 className="text-base font-bold text-ink">Thông tin cơ bản</h3>
                </div>

                <div className="space-y-5">
                  <MediaUploader
                    value={form.logoUrl}
                    onChange={(url) => setForm({ ...form, logoUrl: url })}
                    onRemove={() => setForm({ ...form, logoUrl: undefined })}
                    label="Logo quán"
                  />

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-funcafe">Tên quán <span className="text-red-500">*</span></label>
                      <input className="input-funcafe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Fun Cafe chi nhánh 1" required />
                    </div>
                    <div>
                      <label className="label-funcafe">Số điện thoại</label>
                      <input type="tel" className="input-funcafe" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="VD: 0901 234 567" />
                    </div>
                  </div>
                  <div>
                    <label className="label-funcafe">Địa chỉ</label>
                    <input className="input-funcafe" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Số nhà, đường, phường/xã, tỉnh/thành" />
                  </div>
                  <div>
                    <label className="label-funcafe">Mô tả</label>
                    <textarea rows={3} className="input-funcafe resize-none" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Giới thiệu ngắn về quán (không bắt buộc)" />
                  </div>
                  {!creating && (
                    <div className="max-w-xs">
                      <label className="label-funcafe">Trạng thái</label>
                      <select className="input-funcafe" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'open' | 'closed' | 'inactive' })}>
                        <option value="open">Đang mở cửa</option>
                        <option value="closed">Đã đóng cửa</option>
                        <option value="inactive">Ngừng hoạt động</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Nút hành động nằm ngay chân thẻ thông tin — không bị rớt xuống đáy trang */}
                <div className="flex gap-2 pt-5 mt-5 border-t border-line justify-end">
                  {cafes.length > 0 && <button type="button" onClick={() => setMode('list')} className="btn-secondary">Hủy</button>}
                  {/* Sửa/tạo thông tin quán KHÔNG cần gói (quản lý cấp tài khoản, backend không chặn) */}
                  <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : (creating ? 'Tạo quán' : 'Lưu thông tin')}</button>
                </div>
              </div>

              {/* Nhận tiền VietQR — cột phải, lấp khoảng trống của trang */}
              {!creating && (
                <div className="card-funcafe lg:col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-8 h-8 rounded-lg bg-pine/12 text-pine flex items-center justify-center"><Landmark className="w-4 h-4" /></span>
                    <h3 className="text-base font-bold text-ink">Nhận tiền VietQR</h3>
                  </div>
                  <p className="text-xs text-cafe-500 mb-4 ml-10">Dùng để sinh mã VietQR cho khách quét thanh toán tại màn hình bán hàng (POS).</p>
                  <div className="space-y-4">
                    <div>
                      <label className="label-funcafe">Ngân hàng</label>
                      <select className="input-funcafe" value={form.bankBin ?? ''} onChange={e => setForm({ ...form, bankBin: e.target.value || undefined })}>
                        <option value="">— Chọn ngân hàng —</option>
                        {VN_BANKS.map(b => <option key={b.bin} value={b.bin}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label-funcafe">Số tài khoản</label>
                      <input className="input-funcafe" value={form.bankAccountNumber ?? ''} onChange={e => setForm({ ...form, bankAccountNumber: e.target.value || undefined })} placeholder="VD: 1234567890" />
                    </div>
                    <div>
                      <label className="label-funcafe">Tên chủ tài khoản</label>
                      <input className="input-funcafe" value={form.bankAccountName ?? ''} onChange={e => setForm({ ...form, bankAccountName: e.target.value || undefined })} placeholder="VD: NGUYEN VAN A" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---- LIST / HUB ----
  const active = cafes.find(c => c.id === activeCafeId);
  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Quản lý quán"
        description="Tất cả quán của bạn, gói dịch vụ và doanh thu — chọn quán để quản lý."
        actions={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Thêm quán</button>}
      />

      {/* Băng tổng doanh thu gộp mọi quán */}
      <section className="rounded-2xl border border-line bg-white shadow-card overflow-hidden mb-8">
        <div className="flex flex-col sm:flex-row">
          <div className="flex items-center gap-4 bg-bean-tint/70 px-6 py-5 sm:w-[40%] sm:border-r border-line">
            <span className="w-12 h-12 rounded-2xl bg-bean text-white flex items-center justify-center shadow-soft shrink-0">
              <DollarSign className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-bean-dark">Tổng doanh thu · mọi quán</p>
              <p className="text-2xl font-bold text-ink tracking-tight tabular-nums">{formatCurrency(overview?.total ?? 0)}</p>
            </div>
          </div>
          <dl className="flex-1 grid grid-cols-3 divide-x divide-line">
            <SummaryStat icon={CalendarDays} label="Hôm nay" value={formatCurrency(overview?.today ?? 0)} />
            <SummaryStat icon={TrendingUp} label="Tháng này" value={formatCurrency(overview?.thisMonth ?? 0)} />
            <SummaryStat icon={Store} label="Số quán" value={String(cafes.length)} />
          </dl>
        </div>
      </section>

      {/* Danh sách quán */}
      <div className="flex items-center gap-2 mb-3">
        <Store className="w-4 h-4 text-bean" />
        <h2 className="text-base font-bold text-ink">Quán của bạn</h2>
        <span className="text-sm text-cafe-400">({cafes.length})</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cafes.map((cafe) => {
          const rev = revByCafe[cafe.id];
          const isActive = cafe.id === activeCafeId;
          const s = STATUS_META[cafe.status] ?? STATUS_META.open;
          return (
            <article key={cafe.id} className={`group relative flex flex-col rounded-2xl border bg-white shadow-card overflow-hidden lift ${isActive ? 'border-bean ring-1 ring-bean' : 'border-line'}`}>
              {/* Cover + logo */}
              <div className="relative h-16 bg-bean-tint">
                {isActive && (
                  <span className="absolute top-2.5 left-3 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-bean px-2 py-0.5 rounded-full shadow-soft">
                    <Check className="w-3 h-3" />Đang chọn
                  </span>
                )}
                <span className={`absolute top-2.5 right-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                </span>
              </div>
              <div className="px-5 pb-5 -mt-8 flex flex-col flex-1">
                <div className="w-16 h-16 rounded-2xl ring-4 ring-white bg-white shadow-soft overflow-hidden flex items-center justify-center">
                  {cafe.logoUrl ? (
                    <img src={cafe.logoUrl} alt={cafe.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full bg-bean-tint text-bean flex items-center justify-center font-bold text-2xl">{cafe.name?.charAt(0) || 'C'}</span>
                  )}
                </div>
                <h3 className="mt-3 font-bold text-ink text-lg truncate">{cafe.name}</h3>
                <p className="text-xs text-cafe-500 flex items-center gap-1 mt-0.5 truncate min-h-[1rem]">
                  {cafe.address ? <><MapPin className="w-3 h-3 shrink-0" />{cafe.address}</> : <span className="italic text-cafe-400">Chưa có địa chỉ</span>}
                </p>

                {/* Gói + doanh thu */}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-sand/70 px-3.5 py-2.5">
                  <span className="text-xs text-cafe-500 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" />Gói</span>
                  {rev?.hasPackage
                    ? <span className={pkgBadgeClass(rev.packageName)}>{rev.packageName}</span>
                    : <span className="badge-inactive">Chưa có gói</span>}
                </div>
                <div className="mt-2 flex items-baseline justify-between px-1">
                  <span className="text-xs text-cafe-500 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />Doanh thu</span>
                  <span className="text-sm font-bold text-ink tabular-nums">{formatCurrency(rev?.total ?? 0)}</span>
                </div>

                {!rev?.hasPackage && (
                  <a href="/user/subscription" onClick={(e) => { e.preventDefault(); handleSelect(cafe).then(() => { window.location.href = '/user/subscription'; }); }}
                    className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-gold-deep bg-gold/12 border border-gold/25 rounded-lg px-2.5 py-2 hover:bg-gold/20 transition-colors">
                    Mua gói để mở khóa bán hàng
                  </a>
                )}

                <div className="mt-auto pt-4 flex gap-2">
                  {!isActive ? (
                    <button onClick={() => handleSelect(cafe)} className="btn-secondary flex-1 justify-center"><Check className="w-4 h-4" />Chọn quán</button>
                  ) : (
                    <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-bean bg-bean-tint rounded-xl py-2.5">Đang quản lý</span>
                  )}
                  <button onClick={() => openEdit(cafe)} className="btn-secondary justify-center !px-3" title="Sửa thông tin"><Pencil className="w-4 h-4" /></button>
                </div>
              </div>
            </article>
          );
        })}

        {/* Thẻ thêm quán */}
        <button onClick={openCreate} className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-white/50 text-cafe-400 hover:text-bean hover:border-bean hover:bg-bean-tint/40 min-h-[248px] transition-colors">
          <span className="w-14 h-14 rounded-full bg-bean-tint text-bean flex items-center justify-center transition-transform group-hover:scale-110"><Plus className="w-7 h-7" /></span>
          <span className="text-sm font-semibold">Thêm quán mới</span>
        </button>
      </div>
    </div>
  );
}

// Badge gói theo tên snapshot (Fun Free / Pro / Pro Max)
function pkgBadgeClass(name: string | null): string {
  const n = (name ?? '').toLowerCase();
  if (n.includes('max')) return 'badge-promax';
  if (n.includes('pro')) return 'badge-pro';
  if (n.includes('free')) return 'badge-free';
  return 'badge-active';
}

function SummaryStat({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return (
    <div className="px-4 sm:px-5 py-4 flex flex-col justify-center">
      <dt className="text-xs text-cafe-500 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-cafe-400" />{label}</dt>
      <dd className="text-lg font-bold text-ink mt-1 tabular-nums truncate">{value}</dd>
    </div>
  );
}

