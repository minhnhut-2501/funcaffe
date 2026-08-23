'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/user/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { staffService, type NhanVien } from '@/services/staff';
import { canManage, packageLimits } from '@/lib/permission';
import { useToast } from '@/hooks/use-toast';
import { Plus, KeyRound, Lock, Unlock, Users, AlertCircle } from 'lucide-react';

export default function StaffPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ds, setDs] = useState<NhanVien[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [themModal, setThemModal] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', nhapLai: '' });
  const [loiForm, setLoiForm] = useState<string | null>(null);

  const [doiMkTarget, setDoiMkTarget] = useState<NhanVien | null>(null);
  const [mkMoi, setMkMoi] = useState({ mk: '', nhapLai: '' });
  const [khoaTarget, setKhoaTarget] = useState<NhanVien | null>(null);

  const managable = canManage(user?.subscription);
  const limits = packageLimits(user?.subscription);
  const coTran = Number.isFinite(limits.maxStaff);
  const dayTran = coTran && ds.length >= limits.maxStaff;

  const load = () => {
    setLoading(true);
    staffService.list()
      .then(setDs)
      .catch(() => { setError(true); toast({ description: 'Không tải được danh sách nhân viên', variant: 'destructive' }); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const moThem = () => {
    setForm({ fullName: '', email: '', phone: '', password: '', nhapLai: '' });
    setLoiForm(null);
    setThemModal(true);
  };

  const themNhanVien = async () => {
    if (!form.fullName.trim()) return setLoiForm('Nhập họ tên nhân viên.');
    if (!form.email.trim()) return setLoiForm('Nhập email — đó là tên đăng nhập của nhân viên.');
    if (form.password.length < 8) return setLoiForm('Mật khẩu phải từ 8 ký tự.');
    // Kiểm ở đây chứ không để backend trả lỗi: máy chủ chỉ nhận MỘT ô mật khẩu, nên
    // gõ sai ô nhắc lại mà vẫn gửi đi là tạo ra tài khoản với mật khẩu chủ quán tưởng
    // sai — rồi đưa cho nhân viên và không ai đăng nhập được.
    if (form.password !== form.nhapLai) return setLoiForm('Hai ô mật khẩu chưa khớp nhau.');

    setSaving(true);
    try {
      const moi = await staffService.create({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      setDs(prev => [...prev, moi]);
      setThemModal(false);
      toast({ description: `Đã tạo tài khoản cho ${moi.fullName}` });
    } catch (e: unknown) {
      setLoiForm(e instanceof Error ? e.message : 'Không tạo được tài khoản.');
    } finally {
      setSaving(false);
    }
  };

  const datLaiMatKhau = async () => {
    if (!doiMkTarget) return;
    if (mkMoi.mk.length < 8) return setLoiForm('Mật khẩu phải từ 8 ký tự.');
    if (mkMoi.mk !== mkMoi.nhapLai) return setLoiForm('Hai ô mật khẩu chưa khớp nhau.');

    setSaving(true);
    try {
      await staffService.datLaiMatKhau(doiMkTarget.id, mkMoi.mk);
      toast({ description: `Đã đặt lại mật khẩu cho ${doiMkTarget.fullName}. Nhớ báo lại cho họ.` });
      setDoiMkTarget(null);
      setMkMoi({ mk: '', nhapLai: '' });
    } catch {
      setLoiForm('Không đặt lại được mật khẩu.');
    } finally {
      setSaving(false);
    }
  };

  const doiKhoa = async (nv: NhanVien, khoa: boolean) => {
    try {
      const moi = await staffService.update(nv.id, { status: khoa ? 'locked' : 'active' });
      setDs(prev => prev.map(x => (x.id === nv.id ? moi : x)));
      setKhoaTarget(null);
      toast({ description: khoa ? `Đã khóa tài khoản ${nv.fullName}` : `Đã mở lại tài khoản ${nv.fullName}` });
    } catch {
      toast({ description: 'Không đổi được trạng thái tài khoản', variant: 'destructive' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Quản lý nhân viên"
        description="Tài khoản nhân viên chỉ dùng được màn hình Bán hàng."
        actions={
          <div className="flex items-center gap-3">
            {coTran && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${dayTran ? 'bg-red-50 text-red-600 border-red-200' : 'bg-sand text-cafe-600 border-line'}`}>
                {ds.length}/{limits.maxStaff} nhân viên
              </span>
            )}
            <button onClick={moThem} disabled={dayTran || !managable}
              title={!managable ? 'Gói đã hết hạn — chỉ có thể xem'
                : dayTran ? `Gói hiện tại cho tối đa ${limits.maxStaff} nhân viên — nâng lên Pro Max để không giới hạn` : undefined}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus className="w-4 h-4" />Thêm nhân viên
            </button>
          </div>
        }
      />

      {dayTran && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm text-gold-deep">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Gói hiện tại cho tối đa <strong>{limits.maxStaff}</strong> tài khoản nhân viên.
            Nâng lên <strong>Pro Max</strong> để không giới hạn.
            {' '}Tài khoản đã khóa vẫn tính vào số này.
          </p>
        </div>
      )}

      {loading ? <LoadingSkeleton variant="table" rows={4} cols={4} /> : error ? (
        <EmptyState icon={AlertCircle} title="Không tải được danh sách"
          description="Kiểm tra kết nối rồi tải lại trang." />
      ) : ds.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có tài khoản nhân viên nào"
          description="Tạo tài khoản để nhân viên tự đăng nhập bán hàng, và biết được ai bán đơn nào." />
      ) : (
        <div className="bg-white rounded-2xl border border-line overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-sand border-b border-line">
                <tr>
                  <th className="text-left px-5 py-3 text-cafe-600 font-semibold">Họ tên</th>
                  <th className="text-left px-5 py-3 text-cafe-600 font-semibold">Email đăng nhập</th>
                  <th className="text-left px-5 py-3 text-cafe-600 font-semibold">Điện thoại</th>
                  <th className="text-left px-5 py-3 text-cafe-600 font-semibold">Trạng thái</th>
                  <th className="text-right px-5 py-3 text-cafe-600 font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody className="stagger divide-y divide-line/70">
                {ds.map(nv => (
                  <tr key={nv.id} className={`hover:bg-sand/50 transition-colors ${nv.status === 'locked' ? 'opacity-55' : ''}`}>
                    <td className="px-5 py-3 font-semibold text-ink">{nv.fullName}</td>
                    <td className="px-5 py-3 text-cafe-600">{nv.email}</td>
                    <td className="px-5 py-3 text-cafe-600">{nv.phone || '—'}</td>
                    <td className="px-5 py-3">
                      {nv.status === 'active'
                        ? <StatusBadge tone="success">Đang làm</StatusBadge>
                        : <StatusBadge tone="neutral">Đã khóa</StatusBadge>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setDoiMkTarget(nv); setMkMoi({ mk: '', nhapLai: '' }); setLoiForm(null); }}
                          disabled={!managable} title="Đặt lại mật khẩu"
                          className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors disabled:opacity-40">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        {nv.status === 'active' ? (
                          <button onClick={() => setKhoaTarget(nv)} disabled={!managable} title="Khóa tài khoản"
                            className="p-2 text-cafe-400 hover:text-gold-deep hover:bg-gold/10 rounded-lg transition-colors disabled:opacity-40">
                            <Lock className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => doiKhoa(nv, false)} disabled={!managable} title="Mở lại tài khoản"
                            className="p-2 text-pine hover:bg-pine/10 rounded-lg transition-colors disabled:opacity-40">
                            <Unlock className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Không có nút xóa: nhân viên đã bán hàng nằm trong lịch sử hóa đơn (ai mở đơn,
          ai thu tiền). Xóa là hóa đơn cũ mất tên người thu — chỉ khóa. */}

      <Modal open={themModal} onClose={() => setThemModal(false)} title="Thêm nhân viên" size="sm"
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setThemModal(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={themNhanVien} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label-funcafe">Họ tên <span className="text-red-500">*</span></label>
            <input className="input-funcafe" placeholder="VD: Nguyễn Thị B"
              value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="label-funcafe">Email đăng nhập <span className="text-red-500">*</span></label>
            <input className="input-funcafe" type="email" placeholder="VD: b@quancuaban.vn"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label-funcafe">Điện thoại</label>
            <input className="input-funcafe" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label-funcafe">Mật khẩu <span className="text-red-500">*</span></label>
            <input className="input-funcafe" type="password" placeholder="Từ 8 ký tự"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label-funcafe">Nhập lại mật khẩu <span className="text-red-500">*</span></label>
            <input className="input-funcafe" type="password"
              value={form.nhapLai} onChange={e => setForm({ ...form, nhapLai: e.target.value })} />
          </div>
          <p className="text-xs text-cafe-500 leading-relaxed">
            Bạn tự đặt mật khẩu rồi đưa cho nhân viên. Họ đăng nhập ở cùng trang đăng nhập
            và chỉ vào được màn hình Bán hàng.
          </p>
          {loiForm && (
            <p className="text-xs text-red-600 font-medium">{loiForm}</p>
          )}
        </div>
      </Modal>

      <Modal open={!!doiMkTarget} onClose={() => setDoiMkTarget(null)}
        title={`Đặt lại mật khẩu — ${doiMkTarget?.fullName ?? ''}`} size="sm"
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setDoiMkTarget(null)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={datLaiMatKhau} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Đang lưu...' : 'Đặt lại'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label-funcafe">Mật khẩu mới <span className="text-red-500">*</span></label>
            <input className="input-funcafe" type="password" placeholder="Từ 8 ký tự"
              value={mkMoi.mk} onChange={e => setMkMoi({ ...mkMoi, mk: e.target.value })} />
          </div>
          <div>
            <label className="label-funcafe">Nhập lại <span className="text-red-500">*</span></label>
            <input className="input-funcafe" type="password"
              value={mkMoi.nhapLai} onChange={e => setMkMoi({ ...mkMoi, nhapLai: e.target.value })} />
          </div>
          <p className="text-xs text-cafe-500">
            Nhân viên đang đăng nhập sẽ KHÔNG bị đăng xuất. Muốn chặn ngay thì khóa tài khoản.
          </p>
          {loiForm && <p className="text-xs text-red-600 font-medium">{loiForm}</p>}
        </div>
      </Modal>

      <ConfirmModal open={!!khoaTarget} onClose={() => setKhoaTarget(null)}
        onConfirm={() => khoaTarget && doiKhoa(khoaTarget, true)}
        title="Khóa tài khoản"
        message={`Khóa tài khoản của "${khoaTarget?.fullName}"? Họ sẽ bị đăng xuất ngay và không đăng nhập lại được. Hóa đơn họ đã bán vẫn giữ nguyên, và bạn mở lại được bất cứ lúc nào.`}
        confirmLabel="Khóa" loading={saving} />
    </div>
  );
}
