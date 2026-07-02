'use client';
import PublicLayout from '@/components/layouts/PublicLayout';
import Reveal from '@/components/public/Reveal';
import Link from 'next/link';
import {
  Store, Grid3X3, UtensilsCrossed, ShoppingCart, Receipt, BarChart3, CreditCard,
  ArrowRight, HelpCircle, LifeBuoy,
} from 'lucide-react';

type Section = {
  id: string;
  icon: typeof Store;
  title: string;
  intro: string;
  steps: string[];
  img?: string;
  imgLabel?: string;
};

const sections: Section[] = [
  {
    id: 'thiet-lap',
    icon: Store,
    title: '1. Thiết lập thông tin quán',
    intro: 'Bước đầu tiên sau khi đăng ký: nhập thông tin quán để bắt đầu bán hàng.',
    steps: [
      'Vào mục “Thông tin quán” ở thanh menu bên trái.',
      'Nhập tên quán, địa chỉ, số điện thoại và tải logo (nếu có).',
      'Thêm tài khoản ngân hàng nhận tiền để khách quét VietQR khi thanh toán.',
      'Bấm “Lưu thông tin” — quán của bạn đã sẵn sàng.',
    ],
  },
  {
    id: 'ban',
    icon: Grid3X3,
    title: '2. Tạo và quản lý bàn',
    intro: 'Khai báo các bàn trong quán để theo dõi bàn nào trống, bàn nào đang phục vụ.',
    steps: [
      'Mở mục “Quản lý bàn”, bấm “Thêm bàn”.',
      'Đặt tên bàn (VD: Bàn 01), chọn sức chứa và trạng thái ban đầu.',
      'Lặp lại cho tất cả các bàn của quán.',
      'Trạng thái bàn sẽ tự đổi màu khi có order hoặc sau khi thanh toán.',
    ],
    img: '/product/pos-tables.png',
    imgLabel: 'Sơ đồ bàn theo trạng thái',
  },
  {
    id: 'thuc-don',
    icon: UtensilsCrossed,
    title: '3. Thực đơn, size và topping',
    intro: 'Tạo danh mục, thêm món kèm ảnh, nhiều size và topping cho từng món.',
    steps: [
      'Vào “Thực đơn”, tạo danh mục trước (VD: Cà phê, Trà sữa).',
      'Bấm “Thêm món”, nhập tên, giá, tải ảnh và chọn danh mục.',
      'Bật “Có size” để thêm S/M/L với giá riêng; bật “Cho phép topping” nếu cần.',
      'Vào “Cấu hình topping” để chọn topping nào áp dụng cho từng món.',
    ],
    img: '/product/pos-menu.png',
    imgLabel: 'Lưới chọn món khi bán hàng',
  },
  {
    id: 'ban-hang',
    icon: ShoppingCart,
    title: '4. Bán hàng tại quầy (POS)',
    intro: 'Màn hình bán hàng gom bàn, thực đơn và phiếu order về một nơi.',
    steps: [
      'Mở “Bán hàng”, chọn bàn khách đang ngồi ở cột bên trái.',
      'Bấm vào món ở giữa, chọn size/topping/số lượng rồi “Thêm vào order”.',
      'Phiếu order bên phải tự cộng tiền theo từng món.',
      'Bấm “Thanh toán” khi khách xong để chốt đơn và in hóa đơn.',
    ],
    img: '/product/pos-full.png',
    imgLabel: 'Màn hình bán hàng FunCafe',
  },
  {
    id: 'thanh-toan',
    icon: Receipt,
    title: '5. Thanh toán & hóa đơn',
    intro: 'Hỗ trợ tiền mặt, chuyển khoản và VietQR; hóa đơn lưu lại đầy đủ.',
    steps: [
      'Trong phiếu order, bấm “Thanh toán” và chọn phương thức.',
      'Với tiền mặt: nhập tiền khách đưa, hệ thống tính tiền thối.',
      'Với VietQR: khách quét mã, nhận tiền xong bấm “Xác nhận thanh toán”.',
      'Xem lại mọi hóa đơn trong mục “Hóa đơn”, có thể in hoặc tải PDF.',
    ],
  },
  {
    id: 'doanh-thu',
    icon: BarChart3,
    title: '6. Doanh thu & báo cáo',
    intro: 'Theo dõi doanh thu theo ngày/tháng/năm và món bán chạy (gói Pro trở lên).',
    steps: [
      'Mở mục “Doanh thu” để xem tổng quan và biểu đồ.',
      'Lọc theo khoảng ngày hoặc đổi chế độ xem ngày/tháng/năm.',
      'Xem “Top 5 món bán chạy” để biết món nào hút khách.',
      'Bấm “Xuất Excel” để lưu báo cáo về máy.',
    ],
    img: '/product/revenue.png',
    imgLabel: 'Báo cáo doanh thu',
  },
  {
    id: 'goi',
    icon: CreditCard,
    title: '7. Gói dịch vụ',
    intro: 'Bắt đầu miễn phí, nâng cấp khi quán cần thêm tính năng.',
    steps: [
      'Vào “Gói đang dùng” để xem gói hiện tại và ngày hết hạn.',
      'Chọn gói phù hợp và thời hạn (1 / 3 / 12 tháng).',
      'Thanh toán online qua VNPay để kích hoạt tự động.',
      'Khi nâng cấp giữa kỳ, phần thời gian còn lại của gói cũ được hoàn lại theo tỷ lệ.',
    ],
  },
];

export default function SupportPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="hero-glow border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 md:pt-20 md:pb-16">
          <Reveal as="span" className="chip-pine mb-4"><LifeBuoy className="w-3.5 h-3.5" />Trung tâm hỗ trợ</Reveal>
          <Reveal as="h1" delay={70} className="text-3xl md:text-4xl font-bold text-ink tracking-tight mt-4 mb-3">
            Hướng dẫn sử dụng FunCafe
          </Reveal>
          <Reveal as="p" delay={130} className="text-ink/70 text-base md:text-lg max-w-2xl">
            Làm theo từng bước bên dưới để thiết lập và vận hành quán. Không cần rành công nghệ.
          </Reveal>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 grid lg:grid-cols-[260px_1fr] gap-10 lg:gap-14">
        {/* ToC */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/40 mb-3">Mục lục</p>
          <nav className="space-y-1">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-ink/70 hover:bg-white hover:text-bean transition-colors">
                <s.icon className="w-4 h-4 shrink-0 text-bean" />
                <span className="truncate">{s.title}</span>
              </a>
            ))}
          </nav>
          <div className="mt-6 rounded-2xl bg-white border border-line p-4 shadow-sm">
            <p className="text-sm font-semibold text-ink mb-1 flex items-center gap-1.5"><HelpCircle className="w-4 h-4 text-bean" />Cần thêm trợ giúp?</p>
            <p className="text-xs text-ink/60 mb-3">Đội ngũ FunCafe sẵn sàng hỗ trợ bạn.</p>
            <Link href="/contact" className="btn-cafe-outline w-full text-sm py-2">Liên hệ ngay</Link>
          </div>
        </aside>

        {/* Content */}
        <div className="space-y-14 md:space-y-20 min-w-0">
          {sections.map((s, i) => (
            <Reveal key={s.id} as="section" id={s.id} className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-11 h-11 rounded-xl bg-bean-tint text-bean grid place-items-center shrink-0">
                  <s.icon className="w-5 h-5" />
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-ink leading-tight">{s.title}</h2>
              </div>
              <p className="text-ink/70 leading-relaxed mb-6 max-w-2xl">{s.intro}</p>

              <ol className="space-y-3 mb-6">
                {s.steps.map((step, idx) => (
                  <li key={idx} className="flex gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-bean text-white grid place-items-center text-sm font-bold shrink-0">{idx + 1}</span>
                    <p className="text-ink/80 leading-relaxed pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>

              {s.img && (
                <div className="relative max-w-xl">
                  <div aria-hidden className="absolute -inset-4 rounded-[2rem] bg-gold/8 blur-2xl" />
                  <div className="relative rounded-2xl border border-line bg-white overflow-hidden" style={{ boxShadow: '0 24px 60px -30px rgba(15,23,42,0.35)' }}>
                    <div className="flex items-center gap-1.5 px-3.5 h-8 bg-sand border-b border-line">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                      <span className="w-2.5 h-2.5 rounded-full bg-gold" />
                      <span className="w-2.5 h-2.5 rounded-full bg-pine/60" />
                      {s.imgLabel && <span className="ml-2 text-[10px] text-ink/45 font-medium truncate">{s.imgLabel}</span>}
                    </div>
                    <img src={s.img} alt={s.imgLabel ?? s.title} className="block w-full" loading="lazy" />
                  </div>
                </div>
              )}

              {i < sections.length - 1 && <div className="mt-14 md:mt-20 border-t border-line" />}
            </Reveal>
          ))}

          {/* CTA cuối */}
          <div className="rounded-2xl bg-bean text-white p-6 sm:p-8 text-center">
            <h3 className="text-xl font-bold mb-2">Sẵn sàng bắt đầu?</h3>
            <p className="text-white/75 text-sm mb-5 max-w-md mx-auto">Tạo tài khoản và làm theo hướng dẫn — chỉ vài phút là quán bạn bán được hàng.</p>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-white text-bean hover:bg-paper px-6 py-3 rounded-xl text-sm font-semibold transition-colors">
              Dùng thử miễn phí <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
