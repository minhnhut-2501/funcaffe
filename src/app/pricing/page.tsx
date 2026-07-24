'use client';
import PublicLayout from '@/components/layouts/PublicLayout';
import Reveal from '@/components/public/Reveal';
import Banner from '@/components/public/Banner';
import CtaPanel from '@/components/public/CtaPanel';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { packageService, timeSubscriptionService } from '@/services';
import { formatCurrency } from '@/lib/format';
import type { Package, DurationMonths, TimeSubscription } from '@/types';

const durationValues: { value: DurationMonths; label: string }[] = [
  { value: 1,  label: '1 tháng' },
  { value: 3,  label: '3 tháng' },
  { value: 12, label: '12 tháng' },
];

type CompareCell = boolean | string;

// C1: giới hạn bàn/món đọc từ cấu hình gói (admin chỉnh được) — không hardcode.
function limitLabel(v: number | null | undefined, unit: string): string {
  return v == null || !Number.isFinite(v) ? 'Không giới hạn' : `${v} ${unit}`;
}

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

  // C1: % tiết kiệm tự tính từ giá thật (so gói dài hạn với giá 1 tháng x số tháng)
  const savingsNote = (d: DurationMonths): string => {
    if (d === 1) return '';
    const refPkg = promaxPkg ?? proPkg;
    if (!refPkg) return '';
    const subs = timeSubsMap[refPkg.id] ?? [];
    const p1 = getPrice(refPkg, subs, 1);
    const pd = getPrice(refPkg, subs, d);
    if (p1 <= 0 || pd <= 0) return '';
    const pct = Math.round((1 - pd / (p1 * d)) * 100);
    return pct > 0 ? `Tiết kiệm ${pct}%` : '';
  };

  // C1: bảng so sánh đọc giới hạn từ cấu hình gói do admin chỉnh
  const compareFeatures: { label: string; free: CompareCell; pro: CompareCell; promax: CompareCell }[] = [
    { label: 'Quản lý thông tin quán', free: true, pro: true, promax: true },
    { label: 'Số bàn tối đa',
      free: limitLabel(freePkg?.maxTables, 'bàn'), pro: limitLabel(proPkg?.maxTables ?? 10, 'bàn'), promax: limitLabel(promaxPkg?.maxTables, 'bàn') },
    { label: 'Số món trong thực đơn',
      free: limitLabel(freePkg?.maxMenuItems, 'món'), pro: limitLabel(proPkg?.maxMenuItems ?? 15, 'món'), promax: limitLabel(promaxPkg?.maxMenuItems, 'món') },
    { label: 'Bán hàng theo bàn (POS)', free: true, pro: true, promax: true },
    { label: 'Quản lý order',          free: true, pro: true, promax: true },
    { label: 'Quản lý hóa đơn',        free: true, pro: true, promax: true },
    { label: 'Quản lý size & topping', free: true, pro: true, promax: true },
    { label: 'In & xuất PDF hóa đơn',  free: true, pro: true, promax: true },
    { label: 'Thống kê & biểu đồ doanh thu', free: true, pro: true, promax: true },
    { label: 'Top món bán chạy & báo cáo',   free: true, pro: true, promax: true },
    { label: 'Trợ lý AI & phân tích doanh thu', free: false, pro: proPkg?.canUseAI ?? false, promax: promaxPkg?.canUseAI ?? true },
  ];

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
          {/* Trên điện thoại: 3 cột đều nhau, nhãn và mức tiết kiệm xuống dòng riêng
              (trước đây cụm "Tiết kiệm 7%" bị ngắt giữa chữ ở màn 390px). */}
          <div
            role="group"
            aria-label="Chọn thời hạn thanh toán"
            className="grid w-full grid-cols-3 gap-1 rounded-xl border border-line bg-white p-1 shadow-sm sm:inline-flex sm:w-auto"
          >
            {durationValues.map((d) => {
              const note = savingsNote(d.value);
              const active = dur === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDur(d.value)}
                  aria-pressed={active}
                  className={`flex min-h-11 flex-col items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-row sm:gap-1.5 sm:px-4 ${
                    active ? 'bg-bean text-white shadow-sm' : 'text-ink/70 hover:text-bean'
                  }`}
                >
                  <span className="whitespace-nowrap">{d.label}</span>
                  {note && (
                    <span className={`whitespace-nowrap text-xs ${active ? 'text-white/90' : 'text-pine'}`}>{note}</span>
                  )}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* 3 gói */}
        <p className="text-center text-xs text-ink/70 -mt-8 mb-8">
          Giá niêm yết chưa bao gồm {(proPkg?.vatRate ?? promaxPkg?.vatRate ?? 10)}% thuế VAT — thuế được cộng khi thanh toán.
        </p>
        <div className="grid sm:grid-cols-3 gap-5 mb-20 items-stretch">
          {cards.map((p, i) => (
            <Reveal
              key={p.key}
              delay={i * 80}
              className={`relative rounded-2xl border bg-white flex flex-col h-full p-6 pt-7 transition-shadow ${
                p.highlight
                  ? 'border-bean ring-2 ring-bean/30 shadow-xl shadow-bean/10'
                  : 'border-line shadow-sm hover:shadow-md'
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-bean px-3.5 py-1 text-xs font-semibold text-white whitespace-nowrap shadow-sm shadow-bean/30">
                  Phổ biến nhất
                </span>
              )}

              {/* Tên gói — to, đậm, nổi bật */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="text-2xl font-extrabold text-ink tracking-tight">{p.name}</h3>
                <span className="chip shrink-0">{p.badge}</span>
              </div>
              <p className="text-ink/70 text-sm mb-5 min-h-[2.5rem]">{p.desc}</p>

              {/* Khối giá — nền nổi bật để mức giá bắt mắt */}
              <div className={`rounded-xl px-5 py-4 mb-6 ${p.highlight ? 'bg-bean text-white' : 'bg-paper border border-line'}`}>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className={`text-4xl font-extrabold tracking-tight ${p.highlight ? 'text-white' : 'text-bean'}`}>{p.price}</span>
                  <span className={`text-sm font-medium ${p.highlight ? 'text-white/90' : 'text-ink/70'}`}>{p.period}</span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink/70">
                    <Check className="w-4 h-4 text-pine shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>

              <Link href="/register" className={`${p.highlight ? 'btn-cafe' : 'btn-cafe-outline'} w-full mt-auto`}>
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
                            ? <Check role="img" aria-label="Có" className="w-4 h-4 text-pine mx-auto" />
                            : <X role="img" aria-label="Không có" className="w-4 h-4 text-ink/45 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>

      {/* Đánh giá chỉ hiển thị ở trang chủ — để đây nữa thì lặp y hệt, làm trang giá dài vô ích */}

      <CtaPanel
        title="Vẫn phân vân chọn gói nào?"
        subtitle="Cứ bắt đầu với bản dùng thử miễn phí 7 ngày, nâng cấp bất cứ lúc nào."
        secondaryLabel="Hỏi tư vấn"
        secondaryHref="/contact"
      />
    </PublicLayout>
  );
}
