'use client';

import PublicLayout from '@/components/layouts/PublicLayout';
import Reveal from '@/components/public/Reveal';
import Banner from '@/components/public/Banner';
import HeroSlider from '@/components/public/HeroSlider';
import ReviewsCarousel from '@/components/public/ReviewsCarousel';
import CtaPanel from '@/components/public/CtaPanel';
import AppShot from '@/components/public/AppShot';
import MiniPos from '@/components/public/MiniPos';
import Link from 'next/link';
import {
  PencilLine, HelpCircle, Layers, Calculator, ShoppingBag, Users,
  Check, ArrowRight, UserPlus, Store, ListPlus, Play, Sparkles,
  Building2, ArrowLeftRight, Wallet, Gift, Zap, Crown,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { packageService, timeSubscriptionService } from '@/services';
import type { Package, TimeSubscription } from '@/types';
import { formatCurrency } from '@/lib/format';
import { moHopChat } from '@/lib/ai-chat-bus';

const planIcons: Record<string, typeof Gift> = { free: Gift, pro: Zap, promax: Crown };

const problems = [
  { icon: PencilLine, text: 'Ghi order bằng giấy dễ nhầm món, sai số lượng.' },
  { icon: HelpCircle, text: 'Khó nhớ bàn nào đã thanh toán, bàn nào còn order.' },
  { icon: Layers, text: 'Thực đơn, size và topping nhiều nên dễ bị rối.' },
  { icon: ShoppingBag, text: 'Kín bàn là không biết ghi đơn cho khách mua mang đi vào đâu.' },
  { icon: Users, text: 'Giao ca cho nhân viên phải đưa luôn tài khoản chủ quán.' },
  { icon: Calculator, text: 'Cuối ngày mất thời gian ngồi cộng lại doanh thu.' },
];

/**
 * Một khu khoe sản phẩm. Hai kiểu minh hoạ, và `live` là thứ phân biệt chúng:
 *   - `live: true`  → dựng lại màn hình bằng DOM chạy thật (MiniPos), không có ảnh.
 *   - còn lại       → ảnh chụp giao diện thật, lưu ở public/product.
 *
 * `img` và `label` để tuỳ chọn chính vì khu `live` không có ảnh nào cả. Nếu bắt buộc
 * phải có, chỗ đó sẽ phải khai một đường dẫn ảnh không bao giờ được dùng tới — một
 * dòng dữ liệu nói dối, kiểu rác khó chịu nhất vì đọc mã thì không thấy sai.
 */
type Showcase = {
  tag: string;
  title: string;
  desc: string;
  points: string[];
  glow: string;
  live?: true;
  img?: string;
  label?: string;
  imgSize?: [number, number];
  float?: string | null;
};

const showcases: Showcase[] = [
  {
    tag: 'Bán hàng theo bàn',
    title: 'Cả quán gọn trên một màn hình',
    desc: 'Thấy ngay bàn nào trống, bàn nào đang phục vụ. Chọn bàn, chọn món và lên order chỉ trong vài chạm.',
    points: ['Sơ đồ bàn theo màu trạng thái', 'Phiếu order tính tiền tự động', 'Thu tiền mặt, VietQR hoặc VNPay', 'In phiếu ngay khi thu xong'],
    // Khu duy nhất không dùng ảnh: nó chạy thật ngay trên trang (xem MiniPos).
    // Thẻ ảnh nhỏ "pos-cart" trước đây nổi ở góc cũng bỏ luôn — cột phiếu order
    // trong MiniPos CHÍNH LÀ thứ tấm ảnh đó đang khoe, để cả hai là nói hai lần.
    live: true, glow: 'bg-bean/10',
  },
  {
    tag: 'Thực đơn · size · topping',
    title: 'Thực đơn rõ ràng, dễ chọn',
    desc: 'Món theo danh mục, có ảnh, giá theo size và topping. Người dùng mới nhìn là chọn được ngay, không sợ nhầm.',
    points: ['Món có ảnh, chia danh mục', 'Nhiều size và topping cho mỗi món', 'Tìm món tức thì khi quán đông'],
    img: '/product/pos-menu.png', label: 'FunCafe · Thực đơn',
    imgSize: [1118, 1584] as [number, number],
    float: null, glow: 'bg-gold/12',
  },
  {
    tag: 'Bán mang về',
    title: 'Kín bàn vẫn bán được cho khách mua mang đi',
    desc: 'Bấm MANG VỀ là lên order ngay, không cần chọn bàn. Gọi xong thanh toán luôn trong một lượt — khách không phải đứng đợi.',
    points: ['Không chiếm bàn nào của quán', 'Gọi xong thu tiền một lượt', 'Phiếu in ra ghi rõ MANG VỀ'],
    img: '/product/pos-takeaway.png', label: 'FunCafe · Bán mang về',
    float: null, glow: 'bg-gold/12',
  },
  {
    tag: 'Tài khoản nhân viên',
    title: 'Giao ca mà không phải đưa tài khoản chủ quán',
    desc: 'Mỗi người đứng quầy một tài khoản riêng. Họ bán hàng và tra hóa đơn được, còn thực đơn, doanh thu và gói dịch vụ vẫn là của bạn.',
    points: ['Chỉ vào được màn Bán hàng và Hóa đơn', 'Mỗi đơn ghi rõ ai bán, ai thu tiền', 'Nghỉ việc thì khóa, hóa đơn cũ vẫn nguyên'],
    img: '/product/staff.png', label: 'FunCafe · Quản lý nhân viên',
    float: null, glow: 'bg-pine/10',
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
  { icon: Play, title: 'Bắt đầu bán hàng', desc: 'Chọn bàn hoặc bán mang về, lên order rồi thu tiền và in phiếu.' },
];

const aiPoints = [
  'Hỏi nhanh: doanh thu hôm nay, thực đơn và giá từng món',
  'Gợi ý combo và khuyến mãi dựa trên món quán đang bán',
  'Tự phân tích doanh thu, chỉ ra món bán chạy và xu hướng theo ngày/tháng',
];

// Đa quán (đa chi nhánh): một tài khoản quản nhiều quán, mỗi quán có dữ liệu
// riêng, chuyển qua lại bằng bộ chọn ở đầu trang. Ảnh là màn hình thật.
const branchPoints = [
  { icon: Building2, title: 'Thêm quán bao nhiêu tuỳ ý', desc: 'Mỗi chi nhánh có bàn, thực đơn và hóa đơn riêng — không lẫn vào nhau.' },
  { icon: ArrowLeftRight, title: 'Đổi chi nhánh trong một chạm', desc: 'Bộ chọn quán ngay đầu trang, chuyển qua lại mà không cần đăng xuất.' },
  { icon: Wallet, title: 'Tổng doanh thu mọi quán', desc: 'Xem con số gộp của cả chuỗi, hoặc bóc tách doanh thu từng chi nhánh.' },
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
      {/* 1. Hero — slider ảnh thật + scrim, mỗi slide một góc giới thiệu khác nhau */}
      <HeroSlider />

      {/* 1.5 Đa quán — năng lực nổi bật ngay sau hero: một tài khoản, nhiều chi nhánh.
          Ảnh là màn hình thật (danh sách quán + bộ chọn quán). overflow-x-clip vì
          quầng sáng -inset-6 và thẻ nổi tràn nhẹ ra ngoài khung ở màn 390px. */}
      <section className="bg-paper-textured border-b border-line overflow-x-clip">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bean px-3 py-1 text-xs font-semibold text-white">
              <Building2 className="w-3.5 h-3.5" aria-hidden /> Một tài khoản · nhiều chi nhánh
            </span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-ink mt-4 mb-3 leading-[1.15]">
              Có bao nhiêu quán cũng <span className="text-bean">quản trên một tài khoản</span>
            </h2>
            <p className="text-ink/75 leading-relaxed mb-7 max-w-md">
              Mở thêm chi nhánh không phải lập tài khoản mới. Mỗi quán giữ dữ liệu riêng,
              còn bạn thì đổi qua lại và xem tổng doanh thu cả chuỗi chỉ trên một màn hình.
            </p>
            <ul className="space-y-4 mb-8">
              {branchPoints.map((p, i) => (
                <Reveal as="li" key={p.title} delay={i * 80} className="group flex gap-3.5 items-start">
                  <span className="o-icon w-10 h-10 rounded-xl bg-bean/10 border border-bean/15 flex items-center justify-center shrink-0 group-hover:bg-bean group-hover:text-white">
                    <p.icon className="w-5 h-5 text-bean transition-colors duration-300 group-hover:text-white" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-ink leading-snug">{p.title}</p>
                    <p className="text-sm text-ink/65 leading-relaxed mt-0.5">{p.desc}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
            <Link href="/register" className="btn-shop px-6 py-3 text-base inline-flex items-center gap-2">
              Dùng thử miễn phí <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </Reveal>

          <Reveal delay={120} className="relative">
            <div aria-hidden className="absolute -inset-6 rounded-[2.5rem] blur-3xl bg-bean/10" />
            <AppShot src="/product/shops-multi.png" alt="Danh sách nhiều quán trên một tài khoản FunCafe" label="FunCafe · Quản lý quán" className="rotate-[1deg]" />
            {/* troi-le nằm ở THẺ BỌC NGOÀI: một animation đang chạy thắng mọi khai
                báo thường, nên đặt thẳng lên .anh-noi-nho là xoá luôn cú nhấc lên
                lúc rê chuột của chính thẻ đó. */}
            <div className="troi-le absolute -bottom-6 -left-4 z-20 w-[42%] max-w-[210px] hidden sm:block">
              <div className="anh-noi-nho overflow-hidden rounded-xl border border-line bg-white rotate-[-5deg]">
                <img src="/product/shop-switcher.png" alt="Bộ chọn quán để chuyển nhanh giữa các chi nhánh" className="block w-full object-cover object-left-top h-full max-h-[130px]" loading="lazy" />
              </div>
            </div>
          </Reveal>
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
              <Reveal key={p.text} delay={i * 70} className="group flex gap-4 items-start py-5">
                <span className="o-icon w-10 h-10 rounded-xl bg-paper border border-line flex items-center justify-center shrink-0 group-hover:bg-bean-tint group-hover:border-bean/25">
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
                    {s.live ? (
                      <MiniPos />
                    ) : s.img ? (
                      <>
                        <AppShot
                          src={s.img}
                          alt={s.title}
                          label={s.label}
                          className={flip ? 'rotate-[-1deg]' : 'rotate-[1deg]'}
                          width={s.imgSize?.[0]}
                          height={s.imgSize?.[1]}
                        />
                        {s.float && (
                          <div className={`troi-le absolute -bottom-6 z-20 w-[30%] max-w-[150px] ${flip ? '-right-4' : '-left-4'} hidden sm:block`}>
                            <div className={`anh-noi-nho overflow-hidden rounded-xl border border-line bg-white ${flip ? 'rotate-[5deg]' : 'rotate-[-5deg]'}`}>
                              <img src={s.float} alt="" className="block w-full" loading="lazy" />
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
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
            {/* Trợ lý THẬT đang chạy ngay trên trang này — nên mời người ta hỏi thử
                luôn, thay vì chỉ cho xem một tấm ảnh chụp hội thoại. Đây cũng là chỗ
                khoe được tính năng mà không cần đăng ký gì. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                onClick={() => moHopChat('Trợ lý AI của FunCafe làm được những gì cho quán tôi?')}
                className="nut-sang inline-flex min-h-11 items-center gap-2 rounded-xl bg-bean px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.8)] transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(37,99,235,0.9)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-bean/30"
              >
                <span className="relative z-10 inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" aria-hidden /> Hỏi thử ngay
                </span>
              </button>
              <Link href="/pricing" className="link-mui-ten inline-flex items-center gap-1.5 text-bean font-semibold hover:underline text-sm">
                Xem gói Pro Max <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120} className="relative flex justify-center lg:justify-end">
            <div aria-hidden className="absolute -inset-8 rounded-[3rem] bg-bean/10 blur-3xl" />
            <div className="troi-le relative w-full max-w-[340px]">
              <img
                src="/product/ai-chat.png"
                alt="Hộp thoại trợ lý AI của FunCafe đang gợi ý ba combo đồ uống kèm giá cho buổi chiều vắng khách"
                width={768}
                height={1066}
                className="anh-noi block w-full rounded-2xl border border-line bg-white"
                loading="lazy"
              />
            </div>
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
            <div aria-hidden className="duong-noi hidden lg:block absolute top-5 left-[12.5%] right-[12.5%] h-px bg-line" />
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 90} className="group relative">
                {/* Số bước phóng to và bóng đậm lên khi rê vào cả cột — bốn bước này
                    là thứ người xem lướt mắt qua nhiều nhất ở khúc giữa trang. */}
                <div className="o-icon w-10 h-10 rounded-full bg-bean text-white flex items-center justify-center text-sm font-semibold relative z-10 ring-4 ring-white group-hover:bg-bean-dark group-hover:shadow-lg group-hover:shadow-bean/35">
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
        alt="Quán shop đông khách giờ cao điểm"
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
          <div className="grid sm:grid-cols-3 gap-6 pt-3">
            {loadingPkg && packages.length === 0 &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`sk-${i}`} className="flex flex-col rounded-3xl border border-line p-7 bg-white animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-sand mb-4" />
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
              const PlanIcon = planIcons[pkg.type] ?? Gift;
              const sub = (timeSubsMap[pkg.id] ?? []).find(t => t.durationValue === 1 && t.durationUnit === 'month');
              const priceLabel = pkg.isTrial ? 'Miễn phí' : sub ? formatCurrency(sub.price) : 'Liên hệ';
              const period = pkg.isTrial ? '7 ngày dùng thử' : '/ tháng';
              return (
                <Reveal key={pkg.id} delay={i * 80} className="h-full">
                  <div
                    className={`group relative flex h-full flex-col rounded-3xl border p-7 transition-all duration-300 ${
                      highlight
                        ? 'border-bean bg-gradient-to-b from-bean-tint to-white shadow-xl shadow-bean/15 sm:scale-[1.04]'
                        : 'border-line bg-white shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-bean/30'
                    }`}
                  >
                    {highlight && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-bean px-3.5 py-1 text-xs font-semibold text-white shadow-sm shadow-bean/30">
                        <Sparkles className="w-3 h-3" aria-hidden /> Phổ biến nhất
                      </span>
                    )}
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full mb-4 ${
                        highlight ? 'bg-bean text-white' : 'bg-bean-tint text-bean'
                      }`}
                    >
                      <PlanIcon className="w-5 h-5" aria-hidden />
                    </div>
                    <h3 className="font-bold text-ink text-lg mb-3">{pkg.name}</h3>
                    <div className="mb-5">
                      <span className={`text-3xl font-extrabold ${highlight ? 'text-bean' : 'text-ink'}`}>
                        {priceLabel}
                      </span>
                      <p className="text-xs font-medium text-ink/60 mt-1">{period}</p>
                    </div>
                    <ul className="flex-1 space-y-3 mb-6">
                      {pkg.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-ink/70">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pine/10 shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-pine" strokeWidth={3} />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/register"
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg h-11 px-4 text-sm font-semibold transition-colors ${
                        highlight
                          ? 'bg-bean text-white hover:bg-bean-dark'
                          : 'bg-bean-tint text-bean hover:bg-bean/15'
                      }`}
                    >
                      Chọn {pkg.name}
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing" className="link-mui-ten inline-flex items-center gap-1 text-bean font-medium hover:underline text-sm">
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
            {/* Câu này phải đúng ở cả trạng thái rỗng lẫn khi mới có 1 đánh giá —
                "lướt qua để xem thêm" đọc rất kỳ khi chỉ có một thẻ. */}
            <p className="text-ink/70">Toàn bộ đánh giá dưới đây do chính chủ quán đang dùng FunCafe gửi lên.</p>
          </Reveal>
          <ReviewsCarousel />
        </div>
      </section>

      {/* 7. CTA — panel bo tròn nổi trên nền sáng, tách bạch hẳn với footer tối */}
      <CtaPanel
        title="Muốn thử quản lý quán shop bằng FunCafe?"
        subtitle="Tạo tài khoản và dùng thử để xem có hợp với quán của bạn không."
        note="7 ngày miễn phí · Không cần thẻ tín dụng"
      />
    </PublicLayout>
  );
}
