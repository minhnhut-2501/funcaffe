'use client';
import PublicLayout from '@/components/layouts/PublicLayout';
import Reveal from '@/components/public/Reveal';
import Banner from '@/components/public/Banner';
import ReviewsCarousel from '@/components/public/ReviewsCarousel';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { packageService, timeSubscriptionService } from '@/services';
import { formatCurrency } from '@/lib/format';
import type { Package, DurationMonths, TimeSubscription } from '@/types';

const durations: { value: DurationMonths; label: string; note: string }[] = [
  { value: 1,  label: '1 tháng',  note: '' },
  { value: 3,  label: '3 tháng',  note: 'Tiết kiệm 16%' },
  { value: 12, label: '12 tháng', note: 'Tiết kiệm 37%' },
];

type CompareCell = boolean | string;
const compareFeatures: { label: string; free: CompareCell; pro: CompareCell; promax: CompareCell }[] = [
  { label: 'Quản lý thông tin quán', free: true,             pro: true,       promax: true },
  { label: 'Số bàn tối đa',          free: 'Không giới hạn', pro: '10 bàn',   promax: 'Không giới hạn' },
  { label: 'Số món trong thực đơn',  free: 'Không giới hạn', pro: '15 món',   promax: 'Không giới hạn' },
  { label: 'Bán hàng theo bàn (POS)', free: true,            pro: true,       promax: true },
  { label: 'Quản lý order',          free: true,             pro: true,       promax: true },
  { label: 'Quản lý hóa đơn',        free: true,             pro: true,       promax: true },
  { label: 'Quản lý size & topping', free: true,             pro: true,       promax: true },
  { label: 'In & xuất PDF hóa đơn',  free: true,             pro: true,       promax: true },
  { label: 'Thống kê & biểu đồ doanh thu', free: true,       pro: true,       promax: true },
  { label: 'Top món bán chạy & báo cáo',   free: true,       pro: true,       promax: true },
  { label: 'Trợ lý AI (sắp ra mắt)', free: false,            pro: false,      promax: true },
];

function getPrice(pkg: Package, timeSubs: TimeSubscription[], dur: DurationMonths): number {
  if (pkg.isTrial) return 0;
  const found = timeSubs.find(t => t.durationValue === dur && t.durationUnit === 'month');
  return found?.price ?? 0;
}

export default function PricingPage() {
  const [dur, setDur] = useState<DurationMonths>(1);
  const [packages, setPackages] = useState<Package[]>([]);
  const [timeSubsMap, setTimeSubsMap] = useState<Record<string, TimeSubscription[]>>({});

  useEffect(() => {
    (async () => {
      const pkgs = await packageService.list();
      setPackages(pkgs);
      const map: Record<string, TimeSubscription[]> = {};
      for (const p of pkgs) {
        try { map[p.id] = await timeSubscriptionService.listByPackage(p.id); } catch { map[p.id] = []; }
      }
      setTimeSubsMap(map);
    })();
  }, []);

  const freePkg   = packages.find(p => p.isTrial || p.type === 'free');
  const proPkg    = packages.find(p => p.type === 'pro');
  const promaxPkg = packages.find(p => p.type === 'promax');

  const periodLabel = `/${dur === 1 ? 'tháng' : `${dur} tháng`}`;

  const cards = [
    {
      key: 'free',
      name: freePkg?.name ?? 'Fun Free',
      price: 'Miễn phí',
      period: '7 ngày dùng thử',
      badge: 'Dùng thử',
      desc: 'Trải nghiệm trước khi quyết định.',
      features: freePkg?.features ?? ['Trải nghiệm TOÀN BỘ tính năng Pro Max trong 7 ngày', 'Không giới hạn bàn & món', 'Có thống kê doanh thu', 'Chỉ dùng thử 1 lần / tài khoản'],
      highlight: false,
    },
    {
      key: 'pro',
      name: proPkg?.name ?? 'Pro',
      price: proPkg ? formatCurrency(getPrice(proPkg, timeSubsMap[proPkg.id] ?? [], dur)) : 'Liên hệ',
      period: periodLabel,
      badge: 'Phù hợp quán nhỏ',
      desc: 'Đủ dùng cho vận hành hằng ngày.',
      features: proPkg?.features ?? ['Tối đa 10 bàn, 15 món', 'Size và topping', 'Bán hàng theo bàn', 'In và xuất PDF hóa đơn', 'Có thống kê doanh thu'],
      highlight: false,
    },
    {
      key: 'promax',
      name: promaxPkg?.name ?? 'Pro Max',
      price: promaxPkg ? formatCurrency(getPrice(promaxPkg, timeSubsMap[promaxPkg.id] ?? [], dur)) : 'Liên hệ',
      period: periodLabel,
      badge: 'Đầy đủ báo cáo',
      desc: 'Quản lý sâu bằng số liệu.',
      features: promaxPkg?.features ?? ['Tất cả chức năng của gói Pro', 'Thống kê doanh thu', 'Biểu đồ doanh thu', 'Top món bán chạy', 'Báo cáo chi tiết'],
      highlight: true,
    },
  ];

  return (
    <PublicLayout>
      {/* Hero banner ảnh thật */}
      <Banner
        image="/banners/cafe-counter.jpg"
        alt="Quầy pha chế trong quán cafe"
        title="Giá rõ ràng, hợp túi tiền quán nhỏ"
        subtitle="Bắt đầu miễn phí, nâng cấp khi cần thêm tính năng. Không phí ẩn, không ràng buộc."
        align="center"
        size="lg"
        priority
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        {/* Chọn thời hạn */}
        <Reveal className="flex justify-center mb-12">
          <div className="inline-flex bg-white border border-line rounded-xl p-1 gap-1 shadow-sm">
            {durations.map((d) => (
              <button
                key={d.value}
                onClick={() => setDur(d.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dur === d.value ? 'bg-bean text-white shadow-sm' : 'text-ink/70 hover:text-bean'
                }`}
              >
                {d.label}
                {d.note && (
                  <span className={`ml-1.5 text-xs ${dur === d.value ? 'text-white/80' : 'text-pine'}`}>{d.note}</span>
                )}
              </button>
            ))}
          </div>
        </Reveal>

        {/* 3 gói */}
        <div className="grid sm:grid-cols-3 gap-5 mb-20 items-start">
          {cards.map((p, i) => (
            <Reveal
              key={p.key}
              delay={i * 80}
              className={`relative rounded-2xl border p-6 bg-white flex flex-col lift ${
                p.highlight ? 'border-bean ring-1 ring-bean/30 sm:-mt-4 sm:mb-4 shadow-md' : 'border-line'
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-bean px-3 py-1 text-xs font-medium text-white whitespace-nowrap">
                  Phổ biến nhất
                </span>
              )}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-ink">{p.name}</h3>
                <span className="chip">{p.badge}</span>
              </div>
              <p className="text-ink/55 text-sm mb-5">{p.desc}</p>
              <div className="mb-5">
                <span className="text-3xl font-bold text-bean">{p.price}</span>
                <span className="text-sm text-ink/50"> {p.period}</span>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink/70">
                    <Check className="w-4 h-4 text-pine shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={p.highlight ? 'btn-cafe w-full' : 'btn-cafe-outline w-full'}>
                {p.key === 'free' ? 'Dùng thử miễn phí' : 'Đăng ký'}
              </Link>
            </Reveal>
          ))}
        </div>

        {/* So sánh chi tiết */}
        <Reveal>
          <h2 className="text-xl md:text-2xl font-bold text-ink text-center mb-6">So sánh chi tiết các gói</h2>
          <div className="bg-white rounded-2xl border border-line overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-paper border-b border-line">
                <tr>
                  <th className="text-left px-6 py-3 text-ink/70 font-medium">Tính năng</th>
                  <th className="text-center px-4 py-3 text-ink/70 font-medium">Fun Free</th>
                  <th className="text-center px-4 py-3 text-ink/70 font-medium">Pro</th>
                  <th className="text-center px-4 py-3 text-bean font-semibold">Pro Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {compareFeatures.map((row) => (
                  <tr key={row.label} className="hover:bg-paper">
                    <td className="px-6 py-3 text-ink/80">{row.label}</td>
                    {(['free', 'pro', 'promax'] as const).map((k) => (
                      <td key={k} className="px-4 py-3 text-center">
                        {typeof row[k] === 'string'
                          ? <span className="text-ink/80 font-medium">{row[k]}</span>
                          : row[k]
                            ? <Check className="w-4 h-4 text-pine mx-auto" />
                            : <X className="w-4 h-4 text-ink/20 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>

      {/* Review carousel */}
      <section className="bg-paper-textured border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <Reveal className="max-w-2xl mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-3">Các quán đã chọn FunCafe</h2>
            <p className="text-ink/60">Lướt qua để xem họ nói gì sau khi dùng.</p>
          </Reveal>
          <ReviewsCarousel />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-bean-dark text-white">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-20 text-center">
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Vẫn phân vân chọn gói nào?</h2>
            <p className="text-white/70 mb-7 max-w-xl mx-auto">Cứ bắt đầu với bản dùng thử miễn phí 7 ngày, nâng cấp bất cứ lúc nào.</p>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-white text-bean hover:bg-paper active:translate-y-px px-7 py-3 rounded-lg text-base font-semibold transition-colors">
              Dùng thử miễn phí
            </Link>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
