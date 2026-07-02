'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PublicLayout from '@/components/layouts/PublicLayout';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Coffee, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Mật khẩu xác nhận không khớp'); return; }
    if (form.password.length < 8) { setError('Mật khẩu phải có ít nhất 8 ký tự'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { email, token, password: form.password, password_confirmation: form.confirm });
      setDone(true);
    } catch {
      setError('Liên kết không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-160px)] bg-cafe-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-cafe-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Coffee className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-cafe-900">Đặt lại mật khẩu</h1>
          </div>

          <div className="card-funcafe">
            {done ? (
              <div className="text-center space-y-4 py-4">
                <div className="flex justify-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-500" />
                  </div>
                </div>
                <p className="text-cafe-700 text-sm">Mật khẩu đã được đặt lại thành công!</p>
                <Link href="/login" className="btn-primary inline-flex items-center gap-2 mt-2">
                  <ArrowLeft className="w-4 h-4" />Đăng nhập ngay
                </Link>
              </div>
            ) : !token || !email ? (
              <div className="text-center py-4">
                <p className="text-cafe-500 text-sm">Liên kết không hợp lệ.</p>
                <Link href="/forgot-password" className="text-cafe-700 font-medium hover:underline mt-2 inline-block">Gửi lại yêu cầu</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-cafe-500">Nhập mật khẩu mới cho <strong className="text-cafe-700">{email}</strong></p>
                <div>
                  <label className="label-funcafe">Mật khẩu mới <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} className="input-funcafe pr-10"
                      value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-cafe-400">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label-funcafe">Xác nhận mật khẩu <span className="text-red-500">*</span></label>
                  <input type="password" className="input-funcafe"
                    value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required minLength={8} />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                  {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cafe-50 flex items-center justify-center"><p className="text-cafe-400">Đang tải...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
