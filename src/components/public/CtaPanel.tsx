import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal';

/**
 * Khối kêu gọi hành động cuối trang — MỘT kiểu duy nhất cho toàn bộ trang public.
 *
 * Bố cục NGANG (chữ trái · nút phải) thay vì khối vuông canh giữa: khối canh giữa
 * cao lênh khênh, nằm chơ vơ giữa nền sáng và footer tối nên nhìn rất thô.
 * Phần đệm trên cũng giảm mạnh vì section phía trên đã có py-16/20 rồi — cộng dồn
 * hai lần tạo ra khoảng trống rất xa.
 *
 * Nền bean-dark → blue-900 (không dùng bean): nền đậm hơn để chữ phụ màu trắng
 * đạt tương phản ≥ 4.5:1.
 */
export default function CtaPanel({
  title,
  subtitle,
  ctaLabel = 'Dùng thử miễn phí',
  ctaHref = '/register',
  secondaryLabel,
  secondaryHref,
  note,
  className = '',
}: {
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  note?: string;
  className?: string;
}) {
  return (
    <section className={`bg-paper ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12 md:pt-4 md:pb-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-bean-dark to-[#1E3A8A] px-6 py-10 sm:px-10 md:px-12 md:py-12 shadow-xl shadow-bean/20">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl"
            />
            <div className="relative grid gap-7 md:grid-cols-[1.5fr_auto] md:items-center md:gap-10">
              <div className="text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug">{title}</h2>
                <p className="text-white/85 leading-relaxed mt-2.5 md:max-w-lg">{subtitle}</p>
                {note && <p className="text-white/70 text-sm mt-3">{note}</p>}
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 justify-center md:justify-end shrink-0">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center justify-center gap-2 bg-white text-bean-dark hover:bg-paper active:translate-y-px px-6 py-3 rounded-xl text-base font-semibold transition-colors shadow-lg shadow-black/10 whitespace-nowrap"
                >
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                {secondaryLabel && secondaryHref && (
                  <Link
                    href={secondaryHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/20 active:translate-y-px whitespace-nowrap"
                  >
                    {secondaryLabel}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
