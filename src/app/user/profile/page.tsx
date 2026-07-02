'use client';
import { useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import ImageUpload from '@/components/ui/ImageUpload';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services';
import { Eye, EyeOff, AlertCircle, KeyRound } from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profileForm, setProfileForm] = useState({ fullName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '' });
  const [avatar, setAvatar] = useState(user?.avatarUrl ?? '');
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [profileErr, setProfileErr] = useState('');
  const [pwErr, setPwErr] = useState('');

  const handleSaveProfile = async () => {
    setSaving(true); setProfileErr(''); setProfileSaved(false);
    try {
      await userService.updateProfile({ full_name: profileForm.fullName, phone: profileForm.phone, avatar });
      if (refreshUser) await refreshUser();
      setProfileSaved(true);
    } catch (e: any) {
      setProfileErr(e.message || 'Lỗi khi lưu thông tin');
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (pwForm.newPw.length < 8) { setPwErr('Mật khẩu phải có ít nhất 8 ký tự'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwErr('Mật khẩu xác nhận không khớp'); return; }
    setChangingPw(true); setPwErr(''); setPwSaved(false);
    try {
      await userService.changePassword({
        current_password: pwForm.current,
        new_password: pwForm.newPw,
        confirm_password: pwForm.confirm,
      });
      setPwSaved(true);
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (e: any) {
      setPwErr(e.errors?.current_password?.[0] || e.message || 'Lỗi khi đổi mật khẩu');
    } finally { setChangingPw(false); }
  };

  return (
    <div>
      <PageHeader title="Hồ sơ cá nhân" />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="card-funcafe">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-bean-tint flex items-center justify-center text-bean font-bold text-2xl shrink-0 ring-2 ring-white shadow-soft">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (user?.fullName?.charAt(0) ?? 'U')}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-ink truncate">{user?.fullName}</p>
              <p className="text-cafe-500 text-sm truncate">{user?.email}</p>
              <span className="badge-promax mt-1">{user?.subscription.packageName}</span>
            </div>
          </div>

          <h2 className="text-base font-bold text-ink mb-4">Thông tin cá nhân</h2>
          <div className="space-y-4">
            <div>
              <label className="label-funcafe">Ảnh đại diện</label>
              <ImageUpload currentImage={avatar || undefined} onUpload={setAvatar} onRemove={() => setAvatar('')} />
            </div>
            <div>
              <label className="label-funcafe">Họ và tên</label>
              <input className="input-funcafe" value={profileForm.fullName} onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })} />
            </div>
            <div>
              <label className="label-funcafe">Email</label>
              <input type="email" className="input-funcafe" value={profileForm.email} disabled />
            </div>
            <div>
              <label className="label-funcafe">Số điện thoại</label>
              <input type="tel" className="input-funcafe" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} />
            </div>
            {profileErr && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 text-sm"><AlertCircle className="w-4 h-4" /><span>{profileErr}</span></div>}
            <div className="flex items-center gap-3">
              <button onClick={handleSaveProfile} disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
              {profileSaved && <span className="text-pine text-sm font-medium">✓ Đã lưu</span>}
            </div>
          </div>
        </div>

        <div className="card-funcafe">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-xl bg-bean-tint text-bean flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Đổi mật khẩu</h2>
              <p className="text-xs text-cafe-500">Cập nhật mật khẩu để bảo vệ tài khoản.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label-funcafe">Mật khẩu hiện tại</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="input-funcafe pr-10" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-cafe-400">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label-funcafe">Mật khẩu mới</label>
              <input type="password" className="input-funcafe" value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} />
            </div>
            <div>
              <label className="label-funcafe">Xác nhận mật khẩu mới</label>
              <input type="password" className="input-funcafe" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
            </div>
            {pwErr && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 text-sm"><AlertCircle className="w-4 h-4" /><span>{pwErr}</span></div>}
            <div className="flex items-center gap-3">
              <button onClick={handleChangePassword} disabled={changingPw} className="btn-primary">{changingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}</button>
              {pwSaved && <span className="text-pine text-sm font-medium">✓ Đã đổi mật khẩu</span>}
            </div>
            <div className="pt-3 border-t border-line">
              <p className="text-sm text-cafe-500">
                Quên mật khẩu hiện tại?{' '}
                <Link href="/forgot-password" className="text-bean font-medium hover:underline">Đặt lại qua email</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
