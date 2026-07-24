'use client';

import PublicLayout from '@/components/layouts/PublicLayout';
import Reveal from '@/components/public/Reveal';
import Banner from '@/components/public/Banner';
import ReviewsCarousel from '@/components/public/ReviewsCarousel';
import CtaPanel from '@/components/public/CtaPanel';
import AppShot from '@/components/public/AppShot';
import Link from 'next/link';
import {
  PencilLine, HelpCircle, Layers, Calculator,
  Check, ArrowRight, UserPlus, Store, ListPlus, Play, Sparkles,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { packageService, timeSubscriptionService } from '@/services';
import type { Package, TimeSubscription } from '@/types';
import { formatCurrency } from '@/lib/format';

const problems = [
  { icon: PencilLine, text: 'Ghi order bằng giấy dễ nhầm món, sai số lượng.' },
  { icon: HelpCircle, text: 'Khó nhớ bàn nào đã thanh toán, bàn nào còn order.' },
  { icon: Layers, text: 'Thực đơn, size và topping nhiều nên dễ bị rối.' },
  { icon: Calculator, text: 'Cuối ngày mất thời gian ngồi cộng lại doanh thu.' },
];

// Showcase: ảnh chụp giao diện thật của sản phẩm (Cho thấy, đừng kể). Ảnh lưu ở public/product.
const showcases = [
  {
    tag: 'Bán hàng theo bàn',
    title: 'Cả quán gọn trên một màn hình',
    desc: 'Thấy ngay bàn nào trống, bàn nào đang phục vụ. Chọn bàn, chọn món và lên order chỉ trong vài chạm.',
    points: ['Sơ đồ bàn theo màu trạng thái', 'Phiếu order tính tiền tự động', 'Thanh toán tiền mặt / VietQR'],
    img: '/product/pos-full.png', label: 'FunCafe · Bán hàng',
    float: '/product/pos-cart.png', glow: 'bg-bean/10',
  },
  {
    tag: 'Thực đơn · size · topping',
    title: 'Thực đơn rõ ràng, dễ chọn',
    desc: 'Món theo danh mục, có ảnh, giá theo size và topping. Người dùng mới nhìn là chọn được ngay, không sợ nhầm.',
    points: ['Món có ảnh, chia danh mục', 'Nhiều size và topping cho mỗi món', 'Tìm món tức thì khi quán đông'],
    img: '/product/pos-menu.png', label: 'FunCafe · Thực đơn',
    float: null, glow: 'bg-gold/12',
  },
  {
    tag: 'Doanh thu & báo cáo',
    title: 'Biết quán bán được bao nhiêu, ngay lập tức',
    desc: 'Doanh thu theo ngày, tháng, năm; top món bán chạy và bảng hóa đơn — không cần ngồi cộng tay cuối ngày.',
    points: ['Biểu đồ doanh thu trực quan', 'Top 5 món bán chạy', 'Xuất Excel để lưu lại'],
    img: '/product/revenue.png', label: 'FunCafe · Doanh thu',
    float: null, glow: 'bg-pine/10',
  },
];

const steps = [
  { icon: UserPlus, title: 'Tạo tài khoản', desc: 'Đăng ký miễn phí, không cần thẻ tín dụng.' },
  { icon: Store, title: 'Thiết lập thông tin quán', desc: 'Nhập tên quán, địa chỉ và thông tin cơ bản.' },
  { icon: ListPlus, title: 'Thêm bàn và thực đơn', desc: 'Tạo danh sách bàn, danh mục món, size và topping.' },
  { icon: Play, title: 'Bắt đầu bán hàng', desc: 'Chọn bàn, lên order và thanh toán cho khách.' },
];

const aiPoints = [
  'Hỏi nhanh: doanh thu hôm nay, còn bao nhiêu bàn trống',
  'Gợi ý combo và khuyến mãi dựa trên món quán đang bán',
  'Tự phân tích doanh thu, chỉ ra món bán chạy và giờ cao điểm',
];

// Số liệu trấn an hiển thị trên banner ảnh (không phải số kỹ thuật bịa).
const bannerStats = [
  { value: '1 màn hình', label: 'Quản lý toàn bộ quán' },
  { value: '5 phút', label: 'Cài đặt là bán được' },
  { value: '7 ngày', label: 'Dùng thử miễn phí' },
  { value: '0đ', label: 'Chi phí ban đầu' },
];

export default function HomePage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [timeSubsMap, setTimeSubsMap] = useState<Record<string, TimeSubscription[]>>({});
  const [loadingPkg, setLoadingPkg] = useState(true);

  useEffect(() => {
    packageService.list()
      .then(async pkgs => {
        const active = pkgs.filter(p => p.isActive);
        setPackages(active);
        const map: Record<string, TimeSubscription[]> = {};
        for (const p of active) {
          try { map[p.id] = await timeSubscriptionService.listByPackage(p.id); } catch { map[p.id] = []; }
        }
        setTimeSubsMap(map);
      })
      .catch(() => {})
      .finally(() => setLoadingPkg(false));
  }, []);

  return (
    <PublicLayout>
      {/* 1. Hero — full-bleed ảnh thật + scrim, chữ lớn (KiotViet-style) */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/banners/cafe-interior.jpg"
          alt="Không gian quán cafe ấm cúng"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
        {/* Scrim: đậm bên trái để chữ đọc rõ, nhạt dần sang phải */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#0B1220]/92 via-[#0B1220]/72 to-[#0B1220]/40" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0B1220]/75 via-transparent to-transparent" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 lg:py-36">
          <div className="max-w-2xl">
            <Reveal as="span" className="chip">Dành cho quán cafe, trà sữa, nước ép</Reveal>
            <Reveal as="h1" delay={70} className="banner-title text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight mt-5 mb-5">
              Phần mềm quản lý <span className="text-[#93C5FD]">quán cafe</span> gọn nhẹ
            </Reveal>
            <Reveal as="p" delay={140} className="banner-sub text-white/90 text-lg md:text-xl leading-relaxed mb-8 max-w-xl">
              Gom bàn, thực đơn, order, hóa đơn và doanh thu về một màn hình —
              đơn giản, dễ dùng cho cả người dùng mới.
            </Reveal>
            <Reveal as="div" delay={210} className="flex flex-col sm:flex-row gap-3">
              <Link href="/register" className="btn-cafe px-6 py-3 text-base shadow-lg shadow-black/20">Dùng thử miễn phí</Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 active:translate-y-px"
              >
                Xem bảng giá
              </Link>
            </Reveal>
            <Reveal as="p" delay={260} className="banner-sub text-white/75 text-sm mt-4 flex items-center gap-2">
              <Check className="w-4 h-4 text-[#93C5FD]" /> Miễn phí 7 ngày · Không cần thẻ tín dụng
            </Reveal>
          </div>
        </div>
      </section>

      {/* 2. Vấn đề — layout biên tập: tiêu đề dính bên trái + danh sách phân dòng bên phải */}
      <section className="bg-white border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-3 leading-snug">Những việc khiến chủ quán mất thời gian</h2>
            <p className="text-ink/70 leading-relaxed">Khi quán đông khách, vài việc nhỏ hằng ngày dễ trở thành rắc rối.</p>
          </Reveal>
          <div className="divide-y divide-line border-y border-line">
            {problems.map((p, i) => (
              <Reveal key={p.text} delay={i * 70} className="flex gap-4 items-start py-5">
                <span className="w-10 h-10 rounded-xl bg-paper border border-line flex items-center justify-center shrink-0">
                  <p.icon className="w-5 h-5 text-bean" />
                </span>
                <p className="text-ink/80 leading-relaxed pt-2">{p.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Xem sản phẩm thật — ảnh chụp giao diện FunCafe, bố cục zigzag (Cho thấy, đừng kể) */}
      {/* overflow-x-clip: quầng sáng -inset-6 quanh ảnh tràn 8px ra ngoài màn 390px */}
      <section className="bg-paper-textured overflow-x-clip">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <Reveal className="max-w-2xl mb-12 md:mb-16">
            <span className="chip-pine mb-3">Xem tận mắt</span>
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-3 mt-3">Mọi thứ bạn thấy đều là sản phẩm thật</h2>
            <p className="text-ink/70">Không phải ảnh minh hoạ — đây chính là màn hình bạn sẽ dùng mỗi ngày.</p>
          </Reveal>

          <div className="space-y-16 md:space-y-24">
            {showcases.map((s, i) => {
              const flip = i % 2 === 1;
              return (
                <div key={s.title} className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
                  <Reveal className={flip ? 'lg:order-2' : ''}>
                    <span className="chip mb-4">{s.tag}</span>
                    <h3 className="text-xl md:text-2xl font-bold text-ink mb-3 leading-snug">{s.title}</h3>
                    <p className="text-ink/70 leading-relaxed mb-5 max-w-md">{s.desc}</p>
                    <ul className="space-y-2.5">
                      {s.points.map((p) => (
                        <li key={p} className="flex items-start gap-2.5 text-ink/80">
                          <span className="mt-1 w-5 h-5 rounded-full bg-pine/12 text-pine grid place-items-center shrink-0"><Check className="w-3 h-3" /></span>
                          <span className="text-sm leading-relaxed">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                  <Reveal delay={120} className={`relative ${flip ? 'lg:order-1' : ''}`}>
                    <div aria-hidden className={`absolute -inset-6 rounded-[2.5rem] blur-3xl ${s.glow}`} />
                    <AppShot src={s.img} alt={s.title} label={s.label} className={flip ? 'rotate-[-1deg]' : 'rotate-[1deg]'} />
                    {s.float && (
                      <div className={`absolute -bottom-6 z-20 w-[30%] max-w-[150px] rounded-xl border border-line bg-white overflow-hidden ${flip ? '-right-4 rotate-[5deg]' : '-left-4 rotate-[-5deg]'} hidden sm:block`}
                        style={{ boxShadow: '0 22px 48px -20px rgba(15,23,42,0.45)' }}>
                        <img src={s.float} alt="" className="block w-full" loading="lazy" />
                      </div>
                    )}
                  </Reveal>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3.5 Trợ lý AI — điểm khác biệt của gói Pro Max, nối tiếp phần khoe sản phẩm
          (vẫn là "cho thấy" chức năng) trước khi chuyển sang hướng dẫn 4 bước.
          Ảnh là hội thoại THẬT với dữ liệu thật của quán. */}
      <section className="bg-bean-tint border-y border-bean/15 overflow-x-clip">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bean px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="w-3.5 h-3.5" aria-hidden /> Chỉ có ở gói Pro Max
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-ink mt-4 mb-3 leading-snug">
              Hỏi trợ lý AI như hỏi một quản lý quán
            </h2>
            <p className="text-ink/75 leading-relaxed mb-6 max-w-md">
              Trợ lý đọc được dữ liệu thật của quán bạn — bàn, thực đơn, hóa đơn, doanh thu —
              nên trả lời bằng chính con số và tên món của quán, không phải câu trả lời chung chung.
            </p>
            <ul className="space-y-2.5 mb-7">
              {aiPoints.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-ink/80">
                  <span className="mt-1 w-5 h-5 rounded-full bg-bean/15 text-bean grid place-items-center shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                  <span className="text-sm leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-bean font-semibold hover:underline text-sm">
              Xem gói Pro Max <ArrowRight className="w-4 h-4" />
            </Link>
          </Reveal>

          <Reveal delay={120} className="relative flex justify-center lg:justify-end">
            <div aria-hidden className="absolute -inset-8 rounded-[3rem] bg-bean/10 blur-3xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/product/ai-chat.png"
              alt="Hộp thoại trợ lý AI của FunCafe đang gợi ý ba combo đồ uống kèm giá cho buổi chiều vắng khách"
              className="relative w-full max-w-[340px] rounded-2xl border border-line bg-white"
              style={{ boxShadow: '0 34px 80px -34px rgba(15,23,42,0.45)' }}
              loading="lazy"
            />
          </Reveal>
        </div>
      </section>

      {/* 4. Quy trình — timeline ngang có đường nối, không phải lưới card */}
      <section className="bg-white border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <Reveal className="max-w-2xl mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-3">Bắt đầu trong 4 bước</h2>
            <p className="text-ink/70">Không cần kiến thức kỹ thuật, làm theo từng bước là dùng được.</p>
          </Reveal>
          <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div aria-hidden className="hidden lg:block absolute top-5 left-[12.5%] right-[12.5%] h-px bg-line" />
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 90} className="relative">
                <div className="w-10 h-10 rounded-full bg-bean text-white flex items-center justify-center text-sm font-semibold relative z-10 ring-4 ring-white">
                  {i + 1}
                </div>
                <div className="flex items-center gap-2 mt-4 mb-1.5">
                  <s.icon className="w-4 h-4 text-bean" />
                  <h3 className="font-semibold text-ink">{s.title}</h3>
                </div>
                <p className="text-ink/70 text-sm leading-relaxed">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4.5 Banner ảnh thật — ngắt nhịp + số liệu trấn an */}
      <Banner
        image="/banners/cafe-busy.jpg"
        alt="Quán cafe đông khách giờ cao điểm"
        title="Mọi việc trong quán, gọn trên một màn hình"
        subtitle="Từ lúc khách vào bàn đến khi thanh toán và chốt doanh thu cuối ngày, tất cả nằm trong một hệ thống quen tay."
        align="left"
        size="md"
        titleAs="h2"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-9">
          {bannerStats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="rounded-2xl bg-white/12 border border-white/20 backdrop-blur-sm p-4">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-white/80 text-xs mt-1 leading-tight">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </Banner>

      {/* 5. Gói dịch vụ — bảng giá 3 cột, nổi bật gói giữa */}
      <section className="bg-paper-textured">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <Reveal className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-3">Gói dịch vụ</h2>
            <p className="text-ink/70">Bắt đầu với gói dùng thử, nâng cấp khi quán cần thêm tính năng.</p>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto items-start">
            {loadingPkg && packages.length === 0 &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`sk-${i}`} className="rounded-2xl border border-line p-6 bg-white animate-pulse">
                  <div className="h-4 w-24 rounded bg-sand mb-3" />
                  <div className="h-7 w-28 rounded bg-sand mb-5" />
                  <div className="space-y-2.5">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="h-3.5 w-full rounded bg-sand" />
                    ))}
                  </div>
                </div>
              ))}
            {packages.map((pkg, i) => {
              const highlight = pkg.type === 'promax';
              const sub = (timeSubsMap[pkg.id] ?? []).find(t => t.durationValue === 1 && t.durationUnit === 'month');
              const priceLabel = pkg.isTrial ? 'Miễn phí' : sub ? formatCurrency(sub.price) : 'Liên hệ';
              const period = pkg.isTrial ? '7 ngày dùng thử' : '/tháng';
              return (
                <Reveal
                  key={pkg.id}
                  delay={i * 80}
                  className={`relative rounded-2xl border p-6 bg-white lift ${
                    highlight ? 'border-bean ring-1 ring-bean/30 sm:-mt-3 sm:mb-3 shadow-md' : 'border-line'
                  }`}
                >
                  {highlight && (
                    <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-bean px-3 py-1 text-xs font-medium text-white">
                      Phổ biến nhất
                    </span>
                  )}
                  <h3 className="font-bold text-ink mb-1">{pkg.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold text-bean">{priceLabel}</span>
                    <span className="text-xs text-ink/70">{period}</span>
                  </div>
                  <ul className="space-y-2">
                    {pkg.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-ink/70">
                        <Check className="w-4 h-4 text-pine shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing" className="inline-flex items-center gap-1 text-bean font-medium hover:underline text-sm">
              Xem chi tiết bảng giá <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Đánh giá — carousel lướt được, có avatar người dùng */}
      <section className="bg-white border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <Reveal className="max-w-2xl mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-3">Chủ quán nói gì về FunCafe</h2>
            <p className="text-ink/70">Lướt qua để xem thêm phản hồi từ những quán đang dùng hệ thống.</p>
          </Reveal>
          <ReviewsCarousel />
        </div>
      </section>

      {/* 7. CTA — panel bo tròn nổi trên nền sáng, tách bạch hẳn với footer tối */}
      <CtaPanel
        title="Muốn thử quản lý quán cafe bằng FunCafe?"
        subtitle="Tạo tài khoản và dùng thử để xem có hợp với quán của bạn không."
        note="7 ngày miễn phí · Không cần thẻ tín dụng"
      />
    </PublicLayout>
  );
}
