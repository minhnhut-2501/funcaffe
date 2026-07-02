'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import LockedButton from '@/components/ui/LockedButton';
import { useAuth } from '@/context/AuthContext';
import { cafeService, hasCafe, createCafe } from '@/services';
import ImageUpload from '@/components/ui/ImageUpload';
import { useToast } from '@/hooks/use-toast';
import { canEdit } from '@/lib/permission';
import type { CafeInfo } from '@/types';
import { VN_BANKS, findBank } from '@/lib/banks';
import { MapPin, Phone, FileText, Store, Pencil, Landmark } from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  open: { label: 'Đang mở cửa', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  closed: { label: 'Đã đóng cửa', cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  inactive: { label: 'Ngừng hoạt động', cls: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export default function CafePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const pkg = user?.subscription.packageType ?? 'none';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasExistingCafe, setHasExistingCafe] = useState(false);
  const [form, setForm] = useState<CafeInfo | null>(null);

  const emptyForm: CafeInfo = { id: '', name: '', address: '', phone: '', description: '', status: 'open' };

  useEffect(() => {
    hasCafe().then(exists => {
      setHasExistingCafe(exists);
      if (exists) {
        cafeService.get().then(setForm).catch(() => toast({ description: 'Không thể tải thông tin quán', variant: 'destructive' }));
      } else {
        setForm(emptyForm);
        setEditing(true);
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      if (hasExistingCafe) {
        const updated = await cafeService.update(form);
        setForm(updated);
        setEditing(false);
        toast({ description: 'Đã cập nhật thông tin quán' });
      } else {
        await createCafe({ name: form.name, address: form.address, phone: form.phone });
        setHasExistingCafe(true);
        setEditing(false);
        toast({ description: 'Đã tạo quán thành công' });
        router.refresh();
      }
    } catch {
      toast({ description: hasExistingCafe ? 'Lưu thất bại' : 'Tạo quán thất bại', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-cafe-400">Đang tải...</div>;
  if (!form) return <div className="p-6 text-cafe-400">Đang tải...</div>;

  return (
    <div>
      <PageHeader
        title={hasExistingCafe ? 'Thông tin quán' : 'Tạo quán cafe mới'}
        description={hasExistingCafe ? 'Quản lý thông tin cơ bản của quán cafe' : 'Nhập thông tin quán cafe để bắt đầu sử dụng FunCafe'}
        actions={!editing && hasExistingCafe ? (
          <button onClick={() => setEditing(true)} className="btn-secondary"><Pencil className="w-4 h-4" />Chỉnh sửa</button>
        ) : null}
      />

      {!hasExistingCafe && (
        <div className="bg-bean-tint border border-line rounded-2xl p-4 mb-6 text-sm text-ink/80">
          <p className="font-semibold text-bean">Chào mừng bạn đến với FunCafe!</p>
          <p className="mt-1">Vui lòng nhập thông tin quán cafe để bắt đầu sử dụng hệ thống.</p>
        </div>
      )}

      {!editing ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Cột trái: hero + chi tiết liên hệ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero */}
            <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
              <div className="h-24 sm:h-28 bg-gradient-to-r from-bean to-bean-dark relative">
                {(() => { const s = STATUS_META[form.status] ?? STATUS_META.open; return (
                  <span className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                  </span>
                ); })()}
              </div>
              <div className="px-5 sm:px-6 pb-6">
                <div className="relative z-10 w-24 h-24 rounded-2xl bg-white shadow-md ring-4 ring-white overflow-hidden flex items-center justify-center -mt-12">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt={form.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full bg-bean-tint text-bean flex items-center justify-center font-bold text-3xl">
                      {form.name?.charAt(0) || 'C'}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <h2 className="text-xl font-bold text-ink truncate">{form.name || 'Quán của bạn'}</h2>
                  {form.address && <p className="text-sm text-cafe-500 flex items-center gap-1.5 mt-1"><MapPin className="w-3.5 h-3.5 shrink-0" />{form.address}</p>}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="card-funcafe">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-4">Chi tiết liên hệ</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <DetailItem icon={Store} label="Tên quán" value={form.name} />
                <DetailItem icon={Phone} label="Số điện thoại" value={form.phone || '—'} />
                <DetailItem icon={MapPin} label="Địa chỉ" value={form.address || '—'} />
                <DetailItem icon={FileText} label="Mô tả" value={form.description || '—'} full />
              </div>
            </div>
          </div>

          {/* Cột phải: tài khoản nhận tiền VietQR */}
          <div className="card-funcafe lg:sticky lg:top-6">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-4">Tài khoản nhận tiền (VietQR)</h3>
            {form.bankAccountNumber ? (
              <div className="space-y-4">
                <DetailItem icon={Landmark} label="Ngân hàng" value={findBank(form.bankBin)?.name || form.bankBin || '—'} />
                <DetailItem icon={Landmark} label="Số tài khoản" value={form.bankAccountNumber} />
                <DetailItem icon={Landmark} label="Chủ tài khoản" value={form.bankAccountName || '—'} />
              </div>
            ) : (
              <p className="text-sm text-cafe-500">Chưa cấu hình. Thêm tài khoản ngân hàng để khách quét VietQR thanh toán tại POS.</p>
            )}
          </div>
        </div>
      ) : (
      <div className="card-funcafe max-w-2xl">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label-funcafe">Logo quán</label>
              <ImageUpload
                currentImage={form.logoUrl}
                onUpload={(url) => setForm({ ...form, logoUrl: url })}
                onRemove={() => setForm({ ...form, logoUrl: undefined })}
              />
            </div>
            <div>
              <label className="label-funcafe">Tên quán <span className="text-red-500">*</span></label>
              <input className="input-funcafe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label-funcafe">Địa chỉ</label>
              <input className="input-funcafe" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="label-funcafe">Số điện thoại</label>
              <input type="tel" className="input-funcafe" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label-funcafe">Mô tả</label>
              <textarea rows={3} className="input-funcafe resize-none" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label-funcafe">Trạng thái</label>
              <select className="input-funcafe" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'open' | 'closed' | 'inactive' })}>
                <option value="open">Đang mở cửa</option>
                <option value="closed">Đã đóng cửa</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </div>

            <div className="pt-2 border-t border-cafe-100">
              <p className="text-sm font-bold text-cafe-800 mb-1 flex items-center gap-1.5"><Landmark className="w-4 h-4" />Tài khoản nhận tiền (VietQR)</p>
              <p className="text-xs text-cafe-500 mb-3">Dùng để sinh mã VietQR cho khách quét thanh toán tại màn hình bán hàng (POS).</p>
              <div className="grid sm:grid-cols-2 gap-4">
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
                <div className="sm:col-span-2">
                  <label className="label-funcafe">Tên chủ tài khoản</label>
                  <input className="input-funcafe" value={form.bankAccountName ?? ''} onChange={e => setForm({ ...form, bankAccountName: e.target.value || undefined })} placeholder="VD: NGUYEN VAN A" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Hủy</button>
              {canEdit(pkg) ? (
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
              ) : (
                <LockedButton>Lưu thông tin</LockedButton>
              )}
            </div>
          </form>
      </div>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, full }: { icon: typeof Store; label: string; value: string; full?: boolean }) {
  return (
    <div className={`flex items-start gap-3 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="w-9 h-9 rounded-xl bg-bean-tint text-bean flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-cafe-500 font-medium">{label}</p>
        <p className="text-sm text-ink mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}
