'use client';
import { useState } from 'react';
import PublicLayout from '@/components/layouts/PublicLayout';
import Link from 'next/link';
import { Coffee, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err?.errors?.email?.[0] || err?.message || 'Có lỗi xảy ra, vui lòng thử lại sau');
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
            <h1 className="text-2xl font-bold text-cafe-900">Quên mật khẩu</h1>
            <p className="text-cafe-500 text-sm mt-1">Nhập email để nhận hướng dẫn đặt lại mật khẩu</p>
          </div>

          <div className="card-funcafe">
            {sent ? (
              <div className="text-center space-y-4 py-4">
                <div className="flex justify-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-500" />
                  </div>
                </div>
                <p className="text-cafe-700 text-sm">Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.</p>
                <Link href="/login" className="btn-primary inline-flex items-center gap-2 mt-2">
                  <ArrowLeft className="w-4 h-4" />Quay lại đăng nhập
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label-funcafe">Email <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cafe-400" />
                    <input
                      type="email"
                      placeholder="email@example.com"
                      className="input-funcafe pl-10"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                  {loading ? 'Đang gửi...' : 'Gửi hướng dẫn'}
                </button>
                <div className="text-center">
                  <Link href="/login" className="text-sm text-cafe-700 hover:underline font-medium inline-flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" />Quay lại đăng nhập
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
