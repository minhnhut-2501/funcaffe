'use client';
import PublicLayout from '@/components/layouts/PublicLayout';
import AuthAside from '@/components/public/AuthAside';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const points = [
  'Theo dõi bàn và order rõ ràng hơn',
  'Quản lý thực đơn, size và topping trong một nơi',
  'Xem lại hóa đơn khi cần',
];

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading } = useAuth();
  const { toast } = useToast();

  // Đã đăng nhập sẵn -> tự động vào khu vực tương ứng, không hiện lại form
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
    }
  }, [user, isLoading, router]);

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', remember: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const role = await login(form.email, form.password, form.remember);
      toast({ title: 'Thành công', description: 'Đăng nhập thành công!' });
      if (role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/user/dashboard');
      }
    } catch (err: any) {
      const msg = err?.errors?.email?.[0] || err?.message || 'Email hoặc mật khẩu không chính xác.';
      setError(msg);
      toast({ title: 'Đăng nhập thất bại', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="bg-paper">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          {/* Thẻ split hợp nhất: ảnh + form nằm chung 1 khối bo góc, dính liền (không rời rạc) */}
          <div className="grid md:grid-cols-2 overflow-hidden rounded-3xl border border-line bg-white shadow-xl shadow-bean/10">
            {/* Panel ảnh thương hiệu (nửa trái) */}
            <AuthAside
              image="/banners/coffee-cheers.jpg"
              title="Chào mừng bạn quay lại"
              subtitle="Quản lý quán cafe của bạn ngay trên trình duyệt, không cần cài đặt."
              points={points}
            />

            {/* Form (nửa phải) */}
            <div className="p-6 sm:p-8 lg:p-10 flex items-center">
              <div className="w-full max-w-md mx-auto">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-ink">Đăng nhập</h1>
                  <p className="text-ink/70 text-sm mt-1">Nhập thông tin để vào khu vực quản lý.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div>
                    <label htmlFor="login-email" className="label-funcafe">Email</label>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="email@example.com"
                      className="input-funcafe"
                      value={form.email}
                      onChange={e => { setForm({ ...form, email: e.target.value }); if (error) setError(''); }}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="label-funcafe">Mật khẩu</label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Nhập mật khẩu"
                        className="input-funcafe pr-10"
                        value={form.password}
                        onChange={e => { setForm({ ...form, password: e.target.value }); if (error) setError(''); }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        aria-pressed={showPw}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/70 hover:text-bean"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="login-remember" className="flex items-center gap-2 text-sm text-ink/70 cursor-pointer">
                      <input id="login-remember" type="checkbox" checked={form.remember} onChange={e => setForm({ ...form, remember: e.target.checked })} className="rounded" />
                      Ghi nhớ đăng nhập
                    </label>
                    <Link href="/forgot-password" className="text-sm text-bean hover:underline font-medium">Quên mật khẩu?</Link>
                  </div>

                  <button type="submit" disabled={loading} className="btn-cafe w-full py-2.5 disabled:opacity-60">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Đang xử lý...' : 'Đăng nhập'}
                  </button>
                </form>

                <div className="mt-4 pt-4 border-t border-line text-center text-sm text-ink/70">
                  Chưa có tài khoản?{' '}
                  <Link href="/register" className="text-bean font-medium hover:underline">Đăng ký dùng thử</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
