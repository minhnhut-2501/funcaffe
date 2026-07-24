'use client';
import PublicLayout from '@/components/layouts/PublicLayout';
import AuthAside from '@/components/public/AuthAside';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const points = [
  'Dùng thử miễn phí 7 ngày, không cần thẻ tín dụng',
  'Dễ dùng cho quán nhỏ, làm quen nhanh',
  'Quản lý bàn, thực đơn, order và hóa đơn trong một nơi',
];

export default function RegisterPage() {
  const router = useRouter();
  const { register, user, isLoading } = useAuth();
  const { toast } = useToast();

  // Đã đăng nhập sẵn -> tự động vào khu vực tương ứng
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
    }
  }, [user, isLoading, router]);

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', password: '', confirmPassword: '', agree: false,
  });
  const [fieldError, setFieldError] = useState<{ password?: string; confirmPassword?: string }>({});

  const validate = (f = form) => {
    const errs: { password?: string; confirmPassword?: string } = {};
    if (f.password && f.password.length < 8) errs.password = 'Mật khẩu tối thiểu 8 ký tự.';
    if (f.confirmPassword && f.confirmPassword !== f.password) errs.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (errs.password || errs.confirmPassword) {
      setFieldError(errs);
      return;
    }
    setLoading(true);
    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      toast({ title: 'Thành công', description: 'Đăng ký tài khoản thành công!' });
      router.push('/user/cafe');
    } catch (err: any) {
      const msg = err?.errors?.email?.[0] || err?.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      toast({ title: 'Đăng ký thất bại', description: msg, variant: 'destructive' });
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
              image="/banners/cafe-counter.jpg"
              title="Bắt đầu quản lý quán chỉ trong 5 phút"
              subtitle="Đăng ký nhanh và bắt đầu quản lý quán cafe của bạn ngay hôm nay."
              points={points}
            />

            {/* Form (nửa phải) */}
            <div className="p-6 sm:p-8 lg:p-10 flex items-center">
              <div className="w-full max-w-md mx-auto">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-ink">Tạo tài khoản</h1>
                  <p className="text-ink/70 text-sm mt-1">Dùng thử miễn phí 7 ngày, không cần thẻ tín dụng.</p>
                </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="reg-name" className="label-funcafe">Họ và tên <span className="text-red-500">*</span></label>
                  <input id="reg-name" type="text" autoComplete="name" autoFocus placeholder="Nguyễn Văn A" className="input-funcafe" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />
                </div>
                <div>
                  <label htmlFor="reg-email" className="label-funcafe">Email <span className="text-red-500">*</span></label>
                  <input id="reg-email" type="email" autoComplete="email" placeholder="email@example.com" className="input-funcafe" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <label htmlFor="reg-phone" className="label-funcafe">Số điện thoại</label>
                  <input id="reg-phone" type="tel" autoComplete="tel" inputMode="numeric" placeholder="0901234567" className="input-funcafe" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="reg-password" className="label-funcafe">Mật khẩu <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Tối thiểu 8 ký tự"
                      className="input-funcafe pr-10"
                      value={form.password}
                      onChange={e => { const v = e.target.value; setForm({ ...form, password: v }); setFieldError(validate({ ...form, password: v })); }}
                      onBlur={() => setFieldError(validate())}
                      aria-invalid={!!fieldError.password}
                      required
                      minLength={8}
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
                  {fieldError.password
                    ? <p className="mt-1 text-xs text-red-600">{fieldError.password}</p>
                    : <p className="mt-1 text-xs text-ink/70">Dùng ít nhất 8 ký tự.</p>}
                </div>
                <div>
                  <label htmlFor="reg-confirm" className="label-funcafe">Xác nhận mật khẩu <span className="text-red-500">*</span></label>
                  <input
                    id="reg-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu"
                    className="input-funcafe"
                    value={form.confirmPassword}
                    onChange={e => { const v = e.target.value; setForm({ ...form, confirmPassword: v }); setFieldError(validate({ ...form, confirmPassword: v })); }}
                    onBlur={() => setFieldError(validate())}
                    aria-invalid={!!fieldError.confirmPassword}
                    required
                  />
                  {fieldError.confirmPassword && <p className="mt-1 text-xs text-red-600">{fieldError.confirmPassword}</p>}
                </div>
                <label htmlFor="reg-agree" className="flex items-start gap-2 text-sm text-ink/70 cursor-pointer">
                  <input id="reg-agree" type="checkbox" checked={form.agree} onChange={e => setForm({ ...form, agree: e.target.checked })} className="rounded mt-0.5" required />
                  <span>Tôi đồng ý với <span className="text-bean underline">Điều khoản dịch vụ</span> và <span className="text-bean underline">Chính sách bảo mật</span></span>
                </label>
                <button type="submit" disabled={loading} className="btn-cafe w-full py-2.5 disabled:opacity-60">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Đang xử lý...' : 'Tạo tài khoản'}
                </button>
              </form>
                <div className="mt-4 pt-4 border-t border-line text-center text-sm text-ink/70">
                  Đã có tài khoản? <Link href="/login" className="text-bean font-medium hover:underline">Đăng nhập</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
