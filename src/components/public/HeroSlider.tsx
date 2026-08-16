'use client';
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

type Slide = {
  img: string;
  alt: string;
  chip: string;
  /** Tiêu đề tách 3 phần để tô sáng cụm ở giữa. */
  title: [string, string, string];
  sub: string;
  note: string;
};

const SLIDES: Slide[] = [
  {
    img: 'cafe-interior',
    alt: 'Không gian quán cafe ấm cúng',
    chip: 'Dành cho quán cafe, trà sữa, nước ép',
    title: ['Phần mềm quản lý ', 'quán cafe', ' gọn nhẹ'],
    sub: 'Gom bàn, thực đơn, order, hóa đơn và doanh thu về một màn hình — đơn giản, dễ dùng cho cả người dùng mới.',
    note: 'Miễn phí 7 ngày · Không cần thẻ tín dụng',
  },
  {
    img: 'cafe-busy',
    alt: 'Quán cafe đông khách vào giờ cao điểm',
    chip: 'Bán hàng theo bàn',
    title: ['Quán đông vẫn ', 'không rối bàn', ''],
    sub: 'Nhìn sơ đồ là biết bàn nào trống, bàn nào đang phục vụ. Chọn bàn, lên món và thanh toán chỉ trong vài chạm.',
    note: 'Thanh toán tiền mặt hoặc chuyển khoản VietQR',
  },
  {
    img: 'cafe-street',
    alt: 'Quán cafe mặt phố',
    chip: 'Nhiều chi nhánh',
    title: ['Một tài khoản, ', 'quản cả chuỗi quán', ''],
    sub: 'Mỗi chi nhánh có bàn, thực đơn và hóa đơn riêng. Đổi quán ngay trên đầu trang, không cần đăng xuất.',
    note: 'Xem doanh thu từng quán hoặc gộp cả chuỗi',
  },
  {
    img: 'cafe-counter',
    alt: 'Quầy pha chế của quán cafe',
    chip: 'Doanh thu & trợ lý AI',
    title: ['Biết ngay quán ', 'bán được bao nhiêu', ''],
    sub: 'Biểu đồ doanh thu theo ngày, tháng, năm và top món bán chạy — không phải ngồi cộng sổ cuối ngày.',
    note: 'Trợ lý AI tự phân tích và gợi ý cho quán',
  },
];

// 6000ms từng là quá thong thả: người xem đọc xong tiêu đề rồi ngồi chờ, hero trông
// như đứng im. 4200ms vẫn đủ đọc hết một tiêu đề hai dòng mà nhịp trang sống hẳn.
const AUTOPLAY_MS = 4200;

export default function HeroSlider() {
  // Người dùng bật "giảm chuyển động" thì không tự chạy slide.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Không dùng stopOnMouseEnter: hero chiếm gần hết màn hình nên con trỏ gần như
  // luôn nằm trên nó, bật lên là slider đứng yên gần như mãi mãi.
  // stopOnInteraction: false để sau khi người dùng bấm mũi tên/dot thì vẫn chạy tiếp.
  const [emblaRef, embla] = useEmblaCarousel(
    // duration 28 -> 20: cú trượt dứt khoát hơn, hết cảm giác slide bò sang.
    { loop: true, duration: 20 },
    [Autoplay({ delay: AUTOPLAY_MS, stopOnInteraction: false })],
  );
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    onSelect();
    embla.on('select', onSelect);
    return () => { embla.off('select', onSelect); };
  }, [embla]);

  // Dừng hẳn autoplay khi người dùng yêu cầu giảm chuyển động.
  useEffect(() => {
    const autoplay = embla?.plugins()?.autoplay;
    if (!autoplay) return;
    if (reduceMotion) autoplay.stop(); else autoplay.play();
  }, [embla, reduceMotion]);

  const scrollTo = useCallback((i: number) => embla?.scrollTo(i), [embla]);
  const prev = useCallback(() => embla?.scrollPrev(), [embla]);
  const next = useCallback(() => embla?.scrollNext(), [embla]);

  return (
    <section
      className="relative overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Giới thiệu FunCafe"
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {SLIDES.map((s, i) => {
            const active = i === selected;
            // Chữ trượt lên và hiện dần mỗi khi slide được chọn.
            const anim = (delay: number) =>
              ({
                transitionDelay: active ? `${delay}ms` : '0ms',
              }) as const;
            const animClass = `transition-all duration-700 ease-out ${
              active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
            }`;

            return (
              <div
                key={s.img}
                className="relative flex-[0_0_100%] min-w-0"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${SLIDES.length}`}
                aria-hidden={!active}
              >
                <img
                  src={`/banners/${s.img}.jpg`}
                  srcSet={`/banners/${s.img}-900w.jpg 900w, /banners/${s.img}.jpg 1600w`}
                  sizes="100vw"
                  alt={s.alt}
                  // Chỉ ảnh ĐANG HIỆN mới trôi, để mỗi lượt chuyển slide là một lượt
                  // trôi mới từ đầu. Gắn cho cả ba ảnh thì slide sau hiện ra giữa
                  // chừng chu kỳ, lúc đậm lúc nhạt không theo quy luật nào.
                  className={`absolute inset-0 w-full h-full object-cover ${active ? 'anh-troi' : ''}`}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'low'}
                />
                {/* Scrim: đậm bên trái để chữ đọc rõ, nhạt dần sang phải */}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#0B1220]/92 via-[#0B1220]/72 to-[#0B1220]/40" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0B1220]/75 via-transparent to-transparent" />

                <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 lg:py-36">
                  <div className="max-w-2xl">
                    <span className={`chip ${animClass}`} style={anim(0)}>{s.chip}</span>
                    <h1
                      className={`banner-title text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight mt-5 mb-5 ${animClass}`}
                      style={anim(90)}
                    >
                      {s.title[0]}
                      <span className="text-[#93C5FD]">{s.title[1]}</span>
                      {s.title[2]}
                    </h1>
                    <p
                      className={`banner-sub text-white/90 text-lg md:text-xl leading-relaxed mb-8 max-w-xl ${animClass}`}
                      style={anim(170)}
                    >
                      {s.sub}
                    </p>
                    <div className={`flex flex-col sm:flex-row gap-3 ${animClass}`} style={anim(240)}>
                      <Link
                        href="/register"
                        tabIndex={active ? 0 : -1}
                        className="btn-cafe px-6 py-3 text-base shadow-lg shadow-black/20"
                      >
                        Dùng thử miễn phí
                      </Link>
                      <Link
                        href="/pricing"
                        tabIndex={active ? 0 : -1}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 active:translate-y-px"
                      >
                        Xem bảng giá
                      </Link>
                    </div>
                    <p
                      className={`banner-sub text-white/75 text-sm mt-4 flex items-center gap-2 ${animClass}`}
                      style={anim(300)}
                    >
                      <Check className="w-4 h-4 text-[#93C5FD] shrink-0" /> {s.note}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mũi tên: ẩn trên điện thoại vì ở đó vuốt ngang là thao tác tự nhiên hơn. */}
      <button
        type="button"
        onClick={prev}
        aria-label="Slide trước"
        className="hidden md:grid absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 place-items-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/45 focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Slide sau"
        className="hidden md:grid absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 place-items-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/45 focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.img}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Chuyển tới slide ${i + 1}`}
            aria-current={i === selected}
            className={`h-2 rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white/70 ${
              i === selected ? 'w-8 bg-white' : 'w-2 bg-white/45 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
