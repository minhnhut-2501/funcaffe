import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import Reveal from './Reveal';

/**
 * Khối kêu gọi hành động cuối trang — MỘT kiểu duy nhất cho toàn bộ trang public.
 *
 * Bố cục NGANG (chữ trái · nút phải) và đệm trên rất mỏng: giữ nguyên từ bản trước,
 * vì khối canh giữa cao lênh khênh cộng hai lớp đệm là lý do cuối trang từng nhìn thô.
 *
 * VÌ SAO DỰNG LẠI: bản cũ là một hình chữ nhật xanh phẳng — và nó là khối DUY NHẤT
 * trên trang từ chối mọi vũ khí mạnh nhất của chính hệ thống này: không ảnh quán
 * thật, không hoạ tiết, không bằng chứng, không điểm nhấn. Trong khi cả trang được
 * dựng trên nguyên tắc "Cho thấy, đừng kể". Đứng ngay trước footer tối, nó thành ra
 * khối nhạt nhất ở đúng chỗ đáng lẽ phải thuyết phục nhất.
 *
 * Nay khối này dùng lại đúng ba thứ trang đã có: ẢNH QUÁN THẬT (public/banners),
 * HOẠ TIẾT CHẤM của .bg-paper-textured (đảo màu cho nền tối), và DẤU CHECK vốn dùng
 * cho mọi danh sách lợi ích. Nền vẫn xanh đậm để chữ trắng đạt AA — ảnh chỉ nằm dưới
 * lớp phủ để tạo chiều sâu và hơi ấm, không tranh chỗ với chữ.
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
  /** Dòng trấn an. Ngăn bằng "·" để tách thành từng ý có dấu check. */
  note?: string;
  className?: string;
}) {
  // Tách "7 ngày miễn phí · Không cần thẻ tín dụng" thành hai ý riêng: một dòng chữ
  // mờ nhỏ xíu thì mắt lướt qua, còn từng ý có dấu check thì đọc được và đáng tin.
  const yTranAn = (note ?? '').split('·').map((s) => s.trim()).filter(Boolean);

  return (
    <section className={`bg-paper ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12 md:pt-4 md:pb-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-bean-dark shadow-2xl shadow-bean/25">
            {/* Ảnh quán thật nằm dưới cùng — cho khối này hơi ấm và chiều sâu mà một
                mảng màu phẳng không bao giờ có. Trôi rất chậm nên khối không đứng chết. */}
            <img
              src="/banners/coffee-cheers.jpg"
              alt=""
              aria-hidden
              loading="lazy"
              className="anh-troi absolute inset-0 h-full w-full object-cover object-center"
            />

            {/* Lớp phủ xanh: gần như đặc bên trái nơi có chữ, tan dần sang phải để
                quán shop thật LỘ RA. Dìm đều tay cả khối thì ảnh chỉ còn là mấy vệt
                màu vô nghĩa — mất hẳn hơi ấm, mà hơi ấm mới là lý do đặt ảnh vào.
                Chữ trắng chỉ nằm ở nửa trái nên tương phản vẫn đạt AA. */}
            {/* Di động: chữ canh giữa nên trải hết bề ngang — phủ ĐỀU và đậm, không
                được để nửa phải nhạt vì chữ nằm ngay trên đó.
                Từ md trở lên: chữ dồn về trái, lúc đó mới tan dần cho ảnh lộ ra. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[#0E245F]/92 md:bg-transparent md:bg-gradient-to-r md:from-[#0E245F] md:from-35% md:via-[#16307F]/90 md:to-[#1E3A8A]/35"
            />
            {/* Đáy tối nhẹ: giữ chân khối, tránh cảnh ảnh sáng chạm mép dưới. */}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0E245F]/70 via-transparent to-transparent" />
            <div aria-hidden className="absolute inset-0 bg-cham-toi opacity-70" />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-40 -right-24 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl"
            />

            <div className="relative z-10 px-6 py-11 sm:px-10 md:px-12 md:py-14">
              <div className="grid gap-8 md:grid-cols-[1.5fr_auto] md:items-center md:gap-12">
                <div className="text-center md:text-left">
                  <h2 className="text-[1.75rem] leading-[1.15] tracking-tight font-bold text-white md:text-4xl text-balance">
                    {title}
                  </h2>
                  <p className="text-white/90 leading-relaxed mt-3.5 md:max-w-lg md:text-lg">
                    {subtitle}
                  </p>

                  {yTranAn.length > 0 && (
                    <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2.5 md:justify-start">
                      {yTranAn.map((y) => (
                        <li key={y} className="flex items-center gap-2 text-sm font-medium text-white">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 shrink-0">
                            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                          </span>
                          {y}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col gap-3 justify-center sm:flex-row md:flex-col md:justify-end lg:flex-row shrink-0">
                  <Link
                    href={ctaHref}
                    className="nut-sang link-mui-ten group inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-7 text-base font-bold text-bean-dark shadow-[0_12px_28px_-10px_rgba(2,6,23,0.65)] transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-12px_rgba(2,6,23,0.75)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                  >
                    <span className="relative z-10">{ctaLabel}</span>
                    <ArrowRight className="relative z-10 h-4 w-4" aria-hidden />
                  </Link>

                  {secondaryLabel && secondaryHref && (
                    <Link
                      href={secondaryHref}
                      className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/40 bg-white/10 px-7 text-base font-semibold text-white transition-colors duration-200 hover:border-white/70 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                    >
                      {secondaryLabel}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
