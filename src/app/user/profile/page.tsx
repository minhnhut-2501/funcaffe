'use client';
import { useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import AvatarUploader from '@/components/ui/AvatarUploader';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services';
import { getPackageBadgeClass } from '@/lib/permission';
import { Eye, EyeOff, AlertCircle, KeyRound, Mail, User as UserIcon, Phone, ShieldCheck, Check } from 'lucide-react';

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

  const initial = user?.fullName?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <div className="max-w-5xl">
      <PageHeader title="Hồ sơ cá nhân" description="Quản lý thông tin tài khoản và bảo mật của bạn." />

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* Thông tin cá nhân */}
        <div className="lg:col-span-3 rounded-2xl border border-line bg-white shadow-card overflow-hidden">
          {/* Cover + avatar (badge camera kiểu Facebook để đổi ảnh) */}
          <div className="h-20 bg-bean-tint" />
          <div className="px-6 pb-6 -mt-10">
            <AvatarUploader value={avatar || undefined} onChange={setAvatar} onRemove={() => setAvatar('')} fallback={initial} size={80} />
            <h2 className="mt-3 text-xl font-bold text-ink truncate">{user?.fullName}</h2>
            <p className="text-cafe-500 text-sm flex items-center gap-1.5 mt-0.5"><Mail className="w-3.5 h-3.5 shrink-0" />{user?.email}</p>
            <span className={`${getPackageBadgeClass(user?.subscription.packageType ?? 'none')} mt-2`}>{user?.subscription.packageName}</span>
          </div>

          <div className="px-6 pb-6 space-y-5 border-t border-line pt-5">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-bean-tint text-bean flex items-center justify-center"><UserIcon className="w-4 h-4" /></span>
              <h3 className="text-base font-bold text-ink">Thông tin cá nhân</h3>
            </div>

            <div>
              <label className="label-funcafe">Họ và tên</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-cafe-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input className="input-funcafe pl-10" value={profileForm.fullName} onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })} placeholder="Họ và tên của bạn" />
              </div>
            </div>
            <div>
              <label className="label-funcafe">Email <span className="text-cafe-400 font-normal">· không thể đổi</span></label>
              <div className="relative">
                <Mail className="w-4 h-4 text-cafe-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input type="email" className="input-funcafe pl-10 bg-sand/60 text-cafe-500 cursor-not-allowed" value={profileForm.email} disabled />
              </div>
            </div>
            <div>
              <label className="label-funcafe">Số điện thoại</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-cafe-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input type="tel" className="input-funcafe pl-10" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="VD: 0901 234 567" />
              </div>
            </div>
            {profileErr && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 text-sm"><AlertCircle className="w-4 h-4 shrink-0" /><span>{profileErr}</span></div>}
            <div className="flex items-center gap-3 pt-1">
              <button onClick={handleSaveProfile} disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
              {profileSaved && <span className="inline-flex items-center gap-1 text-pine text-sm font-medium"><Check className="w-4 h-4" />Đã lưu</span>}
            </div>
          </div>
        </div>

        {/* Đổi mật khẩu */}
        <div className="lg:col-span-2 card-funcafe">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-10 h-10 rounded-xl bg-pine/12 text-pine flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Đổi mật khẩu</h2>
              <p className="text-xs text-cafe-500">Bảo vệ tài khoản bằng mật khẩu mạnh.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label-funcafe">Mật khẩu hiện tại</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="input-funcafe pr-10" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-cafe-400 hover:text-bean transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label-funcafe">Mật khẩu mới</label>
              <input type={showPw ? 'text' : 'password'} className="input-funcafe" value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} placeholder="Tối thiểu 8 ký tự" />
            </div>
            <div>
              <label className="label-funcafe">Xác nhận mật khẩu mới</label>
              <input type={showPw ? 'text' : 'password'} className="input-funcafe" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Nhập lại mật khẩu mới" />
            </div>
            {pwErr && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 text-sm"><AlertCircle className="w-4 h-4 shrink-0" /><span>{pwErr}</span></div>}
            <div className="flex items-center gap-3 pt-1">
              <button onClick={handleChangePassword} disabled={changingPw} className="btn-primary">{changingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}</button>
              {pwSaved && <span className="inline-flex items-center gap-1 text-pine text-sm font-medium"><Check className="w-4 h-4" />Đã đổi</span>}
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
