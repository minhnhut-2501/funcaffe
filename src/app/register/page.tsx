'use client';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2, User, Mail, Phone, Lock, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AuthShell, { AuthField, PasswordToggle } from '@/components/public/AuthShell';

const aside = {
  image: '/banners/cafe-counter.jpg',
  title: 'Bắt đầu quản lý quán chỉ trong 5 phút',
  subtitle: 'Đăng ký nhanh và bắt đầu quản lý quán cafe của bạn ngay hôm nay.',
  points: [
    'Dùng thử miễn phí 7 ngày, không cần thẻ tín dụng',
    'Dễ dùng cho quán nhỏ, làm quen nhanh',
    'Quản lý bàn, thực đơn, order và hóa đơn trong một nơi',
  ],
};

export default function RegisterPage() {
  const router = useRouter();
  const { register, user, isLoading } = useAuth();
  const { toast } = useToast();

  // Một lệnh chuyển trang duy nhất cho cả hai lối ra khỏi form. Không có cờ
  // này thì đăng ký xong sẽ có hai đích đánh nhau: handleSubmit đưa sang
  // /user/cafe (tạo quán đầu tiên) còn effect bên dưới lại thấy `user` vừa có
  // và đẩy về /user/dashboard.
  const navigated = useRef(false);
  const goTo = useCallback((href: string) => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(href);
  }, [router]);

  // Đã đăng nhập sẵn -> tự động vào khu vực tương ứng
  useEffect(() => {
    if (!isLoading && user) goTo(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
  }, [user, isLoading, goTo]);

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    setError('');
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
      // Tài khoản mới chưa có quán nào -> vào thẳng bước tạo quán đầu tiên.
      goTo('/user/cafe');
    } catch (err: any) {
      const msg = err?.errors?.email?.[0] || err?.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      setError(msg);
      // KHÔNG tắt loading ở nhánh thành công: tài khoản đã tạo xong nhưng còn
      // phải chuyển sang bước tạo quán, mà bước đó có thể mất vài giây. Trả nút
      // về bình thường lúc đó trông như đăng ký hỏng, người dùng sẽ bấm lại.
      toast({ title: 'Đăng ký thất bại', description: msg, variant: 'destructive' });
      setLoading(false);
    }
  };

  return (
    <AuthShell
      aside={aside}
      title="Tạo tài khoản"
      subtitle="Dùng thử miễn phí 7 ngày, không cần thẻ tín dụng."
      error={error}
      onSubmit={handleSubmit}
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link href="/login" className="text-bean font-semibold hover:underline">Đăng nhập</Link>
        </>
      }
    >
      <AuthField
        id="reg-name"
        label="Họ và tên"
        icon={User}
        type="text"
        autoComplete="name"
        autoFocus
        placeholder="Nguyễn Văn A"
        required
        markRequired
        value={form.fullName}
        onChange={e => setForm({ ...form, fullName: e.target.value })}
      />

      <AuthField
        id="reg-email"
        label="Email"
        icon={Mail}
        type="email"
        autoComplete="email"
        placeholder="email@example.com"
        required
        markRequired
        value={form.email}
        onChange={e => { setForm({ ...form, email: e.target.value }); if (error) setError(''); }}
      />

      <AuthField
        id="reg-phone"
        label="Số điện thoại"
        icon={Phone}
        type="tel"
        autoComplete="tel"
        inputMode="numeric"
        placeholder="0901234567"
        value={form.phone}
        onChange={e => setForm({ ...form, phone: e.target.value })}
      />

      <AuthField
        id="reg-password"
        label="Mật khẩu"
        icon={Lock}
        type={showPw ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Tối thiểu 8 ký tự"
        required
        markRequired
        minLength={8}
        hint="Dùng ít nhất 8 ký tự."
        error={fieldError.password}
        value={form.password}
        onChange={e => { const v = e.target.value; setForm({ ...form, password: v }); setFieldError(validate({ ...form, password: v })); }}
        onBlur={() => setFieldError(validate())}
        trailing={<PasswordToggle shown={showPw} onToggle={() => setShowPw(!showPw)} />}
      />

      <AuthField
        id="reg-confirm"
        label="Xác nhận mật khẩu"
        icon={ShieldCheck}
        type="password"
        autoComplete="new-password"
        placeholder="Nhập lại mật khẩu"
        required
        markRequired
        error={fieldError.confirmPassword}
        value={form.confirmPassword}
        onChange={e => { const v = e.target.value; setForm({ ...form, confirmPassword: v }); setFieldError(validate({ ...form, confirmPassword: v })); }}
        onBlur={() => setFieldError(validate())}
      />

      <label htmlFor="reg-agree" className="flex items-start gap-2.5 text-sm text-ink/80 cursor-pointer select-none">
        <input
          id="reg-agree"
          type="checkbox"
          checked={form.agree}
          onChange={e => setForm({ ...form, agree: e.target.checked })}
          required
          className="w-4 h-4 mt-0.5 shrink-0 rounded border-cafe-300 accent-bean focus:ring-2 focus:ring-bean/35"
        />
        <span>
          {/* stopPropagation là BẮT BUỘC: hai link này nằm trong <label htmlFor="reg-agree">,
              mà bấm bất cứ đâu trong label đều toggle checkbox. Thiếu nó thì bấm xem điều
              khoản vừa mở tab mới vừa lặng lẽ bỏ tick ô đồng ý. */}
          Tôi đồng ý với{' '}
          <Link
            href="/terms"
            target="_blank"
            onClick={e => e.stopPropagation()}
            className="text-bean font-medium underline hover:text-bean-dark"
          >
            Điều khoản dịch vụ
          </Link>{' '}
          và{' '}
          <Link
            href="/privacy"
            target="_blank"
            onClick={e => e.stopPropagation()}
            className="text-bean font-medium underline hover:text-bean-dark"
          >
            Chính sách bảo mật
          </Link>
        </span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="btn-cafe w-full h-11 disabled:opacity-60 disabled:pointer-events-none"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Đang xử lý...' : 'Tạo tài khoản'}
      </button>
    </AuthShell>
  );
}
