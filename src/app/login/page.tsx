'use client';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AuthShell, { AuthField, PasswordToggle } from '@/components/public/AuthShell';

const aside = {
  image: '/banners/coffee-cheers.jpg',
  title: 'Chào mừng bạn quay lại',
  subtitle: 'Quản lý quán shop của bạn ngay trên trình duyệt, không cần cài đặt.',
  points: [
    'Theo dõi bàn và order rõ ràng hơn',
    'Quản lý thực đơn, size và topping trong một nơi',
    'Xem lại hóa đơn khi cần',
  ],
};

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading } = useAuth();
  const { toast } = useToast();

  // Điều hướng vào khu vực quản lý — dùng chung cho hai lối vào: đăng nhập
  // thành công, và mở /login khi đã có phiên sẵn. Cờ `navigated` để hai lối đó
  // không cùng bắn lệnh chuyển trang trên một tick (trước đây form vừa push,
  // effect vừa replace, hai lệnh chồng nhau nên có lúc đứng lại ở /login).
  const navigated = useRef(false);
  const goToArea = useCallback((role: 'user' | 'admin') => {
    if (navigated.current) return;
    navigated.current = true;
    // replace: đã vào trong rồi thì nút Back không nên quay lại form đăng nhập.
    router.replace(role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
  }, [router]);

  // Đã đăng nhập sẵn -> tự động vào khu vực tương ứng, không hiện lại form
  useEffect(() => {
    if (!isLoading && user) goToArea(user.role);
  }, [user, isLoading, goToArea]);

  const [showPw, setShowPw] = useState(false);
  // Hai chặng tách bạch: kiểm tra thông tin đăng nhập, rồi chuyển sang khu vực
  // quản lý. Chặng sau có thể lâu nên phải nói rõ đang làm gì.
  const [phase, setPhase] = useState<'idle' | 'checking' | 'entering'>('idle');
  const loading = phase !== 'idle';
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', remember: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPhase('checking');
    try {
      const role = await login(form.email, form.password, form.remember);
      toast({ title: 'Thành công', description: 'Đăng nhập thành công!' });
      setPhase('entering');
      goToArea(role);
      // KHÔNG tắt loading ở đây. Đăng nhập xong mới bắt đầu chuyển sang khu vực
      // quản lý, mà bước đó có thể mất vài giây (lần đầu vào một route, mạng
      // chậm). Trả nút về trạng thái bình thường lúc này khiến màn hình trông
      // y như đăng nhập không ăn — người dùng bấm lại lần nữa. Giữ nút quay
      // cho tới khi trang mới thực sự hiện ra và component này bị gỡ.
    } catch (err: any) {
      const msg = err?.errors?.email?.[0] || err?.message || 'Email hoặc mật khẩu không chính xác.';
      setError(msg);
      toast({ title: 'Đăng nhập thất bại', description: msg, variant: 'destructive' });
      setPhase('idle');
    }
  };

  return (
    <AuthShell
      aside={aside}
      title="Đăng nhập"
      subtitle="Nhập thông tin để vào khu vực quản lý."
      error={error}
      onSubmit={handleSubmit}
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link href="/register" className="text-bean font-semibold hover:underline">Đăng ký dùng thử</Link>
        </>
      }
    >
      <AuthField
        id="login-email"
        label="Email"
        icon={Mail}
        type="email"
        autoComplete="email"
        autoFocus
        placeholder="email@example.com"
        required
        value={form.email}
        onChange={e => { setForm({ ...form, email: e.target.value }); if (error) setError(''); }}
      />

      <AuthField
        id="login-password"
        label="Mật khẩu"
        icon={Lock}
        type={showPw ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="Nhập mật khẩu"
        required
        value={form.password}
        onChange={e => { setForm({ ...form, password: e.target.value }); if (error) setError(''); }}
        trailing={<PasswordToggle shown={showPw} onToggle={() => setShowPw(!showPw)} />}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label htmlFor="login-remember" className="flex items-center gap-2 text-sm text-ink/80 cursor-pointer select-none">
          <input
            id="login-remember"
            type="checkbox"
            checked={form.remember}
            onChange={e => setForm({ ...form, remember: e.target.checked })}
            className="w-4 h-4 rounded border-cafe-300 text-bean accent-bean focus:ring-2 focus:ring-bean/35"
          />
          Ghi nhớ đăng nhập
        </label>
        <Link href="/forgot-password" className="text-sm text-bean hover:underline font-medium">
          Quên mật khẩu?
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-shop w-full h-11 disabled:opacity-60 disabled:pointer-events-none"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {phase === 'checking' ? 'Đang kiểm tra...' : phase === 'entering' ? 'Đang mở khu vực quản lý...' : 'Đăng nhập'}
      </button>
    </AuthShell>
  );
}
