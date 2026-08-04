import type { ReactNode } from 'react';
import Link from 'next/link';
import { Info, ScrollText } from 'lucide-react';
import PublicLayout from '@/components/layouts/PublicLayout';
import Reveal from '@/components/public/Reveal';

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

/**
 * Khung chung cho Điều khoản dịch vụ và Chính sách bảo mật.
 *
 * Bố cục lấy lại từ Trung tâm hỗ trợ (hero + mục lục dính bên trái) vì nó đã
 * chứng minh được ở khoảng dài. Khác một chỗ: mục lục ở đây KHÔNG có icon —
 * hướng dẫn có 7 bước nên icon giúp nhận ra bước nào, còn 11-13 mục pháp lý mà
 * mỗi mục một biểu tượng thì chỉ thành hàng rào ký hiệu vô nghĩa.
 */
export default function LegalPage({
  badge,
  title,
  subtitle,
  updatedAt,
  sections,
}: {
  badge: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
  return (
    <PublicLayout>
      <section className="hero-glow border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 md:pt-20 md:pb-16">
          <Reveal as="span" className="chip mb-4"><ScrollText className="w-3.5 h-3.5" />{badge}</Reveal>
          <Reveal as="h1" delay={70} className="text-3xl md:text-4xl font-bold text-ink tracking-tight mt-4 mb-3">
            {title}
          </Reveal>
          <Reveal as="p" delay={130} className="text-ink/70 text-base md:text-lg max-w-2xl">
            {subtitle}
          </Reveal>
          <Reveal as="p" delay={180} className="text-sm text-ink/60 mt-4">
            Cập nhật lần cuối: {updatedAt}
          </Reveal>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 grid lg:grid-cols-[260px_1fr] gap-10 lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/70 mb-3">Mục lục</p>
          <nav className="space-y-0.5">
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex gap-2 px-3 py-2 rounded-xl text-sm text-ink/70 hover:bg-white hover:text-bean transition-colors"
              >
                <span className="tabular-nums text-ink/45 shrink-0">{i + 1}.</span>
                <span>{s.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          {/* Nói thẳng tính chất sản phẩm ngay đầu văn bản: đây là đồ án, cổng thanh
              toán chạy môi trường thử nghiệm. Không có dòng này thì cả hai trang đọc
              như cam kết của một pháp nhân không tồn tại. */}
          <div className="flex gap-3 rounded-2xl border border-gold/40 bg-gold/8 p-5 mb-12">
            <Info className="w-5 h-5 text-gold-deep shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm text-ink/80 leading-relaxed space-y-1.5">
              <p className="font-semibold text-ink">FunCafe là sản phẩm đồ án tốt nghiệp</p>
              <p>
                Hệ thống chưa vận hành thương mại. Cổng thanh toán đang chạy trên môi trường thử
                nghiệm (sandbox) của VNPay, nên <strong>không phát sinh giao dịch tiền thật</strong>.
              </p>
              <p>
                Tài liệu này mô tả đúng cách hệ thống đang hoạt động, không phải cam kết pháp lý của
                một doanh nghiệp đã đăng ký kinh doanh.
              </p>
            </div>
          </div>

          <div className="space-y-12">
            {sections.map((s, i) => (
              <Reveal key={s.id} as="section" id={s.id} className="scroll-mt-24">
                <h2 className="text-xl md:text-2xl font-bold text-ink leading-tight mb-4">
                  <span className="text-bean">{i + 1}.</span> {s.title}
                </h2>
                <div className="legal-body space-y-4 text-ink/80 leading-relaxed">{s.body}</div>
              </Reveal>
            ))}
          </div>

          <div className="mt-14 rounded-2xl bg-white border border-line p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <p className="font-semibold text-ink mb-0.5">Còn điều gì chưa rõ?</p>
              <p className="text-sm text-ink/70">Gửi câu hỏi cho đội ngũ FunCafe, chúng tôi sẽ trả lời qua email.</p>
            </div>
            <Link href="/contact" className="btn-cafe-outline shrink-0">Liên hệ</Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
