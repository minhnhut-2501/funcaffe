'use client';
import PublicLayout from '@/components/layouts/PublicLayout';
import Banner from '@/components/public/Banner';
import Reveal from '@/components/public/Reveal';
import Link from 'next/link';
import { useState } from 'react';
import { contactService } from '@/services';
import { Mail, Phone, MapPin, Clock, CheckCircle2 } from 'lucide-react';

const info = [
  { icon: Mail, label: 'Email', value: 'support@funcafe.vn', tone: 'bean' as const },
  { icon: Phone, label: 'Điện thoại', value: '1900 1234', tone: 'pine' as const },
  { icon: Clock, label: 'Giờ hỗ trợ', value: 'Thứ 2 - Thứ 7, 8:00 - 22:00', tone: 'bean' as const },
  { icon: MapPin, label: 'Địa chỉ', value: 'TP. Hồ Chí Minh', tone: 'pine' as const },
];

export default function ContactPage() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', cafeName: '', content: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await contactService.send({
        full_name: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        cafe_name: form.cafeName || undefined,
        content: form.content,
      });
      setSent(true);
    } catch {
      setError('Gửi tin nhắn thất bại. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      {/* Hero banner ảnh thật */}
      <Banner
        image="/banners/cafe-street.jpg"
        alt="Một quán cafe nhỏ bên đường"
        title="Liên hệ với FunCafe"
        subtitle="Cần tư vấn thêm cho quán của bạn? Để lại thông tin, đội ngũ của chúng tôi sẽ phản hồi sớm."
        align="center"
        size="lg"
        priority
      />

      <section className="bg-paper-textured">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
          {/* Thông tin liên hệ */}
          <div className="lg:col-span-2 space-y-5">
            <Reveal>
              <h2 className="text-xl font-bold text-ink mb-1">Thông tin liên hệ</h2>
              <p className="text-ink/70 text-sm">Đội ngũ hỗ trợ sẵn sàng giải đáp trong giờ làm việc.</p>
            </Reveal>
            <div className="space-y-3">
              {info.map((c, i) => (
                <Reveal key={c.label} delay={i * 70} className="flex items-start gap-3 bg-white rounded-2xl border border-line p-4 lift">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    c.tone === 'pine' ? 'bg-pine/10 text-pine' : 'bg-bean/10 text-bean'
                  }`}>
                    <c.icon className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-xs text-ink/55">{c.label}</p>
                    <p className="text-ink font-medium text-sm">{c.value}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={120} className="rounded-2xl bg-bean/5 border border-bean/15 p-5">
              <p className="text-sm text-ink/80 leading-relaxed">
                Phù hợp cho quán cafe, trà sữa, nước ép và các quán nhỏ cần quản lý
                bàn, order và hóa đơn gọn gàng hơn.
              </p>
            </Reveal>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            <Reveal className="bg-white rounded-2xl border border-line shadow-sm p-6 md:p-8">
              {sent ? (
                <div className="text-center py-12">
                  <span className="inline-flex w-14 h-14 rounded-full bg-pine/10 items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-pine" />
                  </span>
                  <h3 className="text-lg font-bold text-ink mb-1">Đã gửi thông tin</h3>
                  <p className="text-ink/70 text-sm">Chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.</p>
                  <button onClick={() => setSent(false)} className="btn-cafe-outline mt-5">Gửi tin khác</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h2 className="text-lg font-bold text-ink">Gửi yêu cầu tư vấn</h2>
                  <div>
                    <label className="label-funcafe">Họ và tên <span className="text-red-500">*</span></label>
                    <input className="input-funcafe" placeholder="Nguyễn Văn A" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-funcafe">Email <span className="text-red-500">*</span></label>
                      <input type="email" className="input-funcafe" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div>
                      <label className="label-funcafe">Số điện thoại</label>
                      <input type="tel" className="input-funcafe" placeholder="0901234567" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label-funcafe">Tên quán cafe</label>
                    <input className="input-funcafe" placeholder="Tên quán của bạn" value={form.cafeName} onChange={e => setForm({ ...form, cafeName: e.target.value })} />
                  </div>
                  <div>
                    <label className="label-funcafe">Nội dung cần tư vấn <span className="text-red-500">*</span></label>
                    <textarea rows={4} className="input-funcafe resize-none" placeholder="Mô tả nhu cầu của quán bạn..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} required />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <button type="submit" disabled={loading} className="btn-cafe w-full py-2.5 disabled:opacity-60">
                    {loading ? 'Đang gửi...' : 'Gửi yêu cầu'}
                  </button>
                </form>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA — panel bo tròn nổi trên nền sáng, tách bạch với footer (đồng bộ trang chủ) */}
      <section className="bg-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-bean to-bean-dark px-6 py-14 md:py-16 text-center shadow-xl shadow-bean/25">
              <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[36rem] rounded-full bg-white/10 blur-3xl" />
              <div className="relative">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Hay là thử luôn cho nhanh?</h2>
                <p className="text-white/75 mb-7 max-w-xl mx-auto">Bạn có thể tạo tài khoản và dùng thử miễn phí ngay, không cần chờ tư vấn.</p>
                <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-white text-bean hover:bg-paper active:translate-y-px px-7 py-3 rounded-xl text-base font-semibold transition-colors shadow-lg shadow-black/10">
                  Dùng thử miễn phí
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
