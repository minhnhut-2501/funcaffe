'use client';
import PublicLayout from '@/components/layouts/PublicLayout';
import Reveal from '@/components/public/Reveal';
import FunCafeReviewSection from '@/components/user/FunCafeReviewSection';
import CtaPanel from '@/components/public/CtaPanel';
import AppShot from '@/components/public/AppShot';
import Link from 'next/link';
import {
  Store, Grid3X3, UtensilsCrossed, ShoppingCart, Receipt, BarChart3, CreditCard,
  HelpCircle, LifeBuoy, Users,
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
      'Đặt tên bàn (VD: Bàn 01) và số chỗ ngồi. Không cần chọn trạng thái — hệ thống tự đổi khi có order hoặc sau khi thanh toán.',
      'Lặp lại cho tất cả các bàn của quán.',
      'Muốn bỏ bớt bàn thì bấm ẩn, KHÔNG xóa: bàn biến khỏi màn Bán hàng nhưng hóa đơn cũ của bàn đó vẫn tra cứu được. Bật lại lúc nào cũng xong.',
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
      'Khách mua mang đi thì bấm nút “MANG VỀ” ngay trên đầu cột bàn — không cần chọn bàn, nên quán kín bàn vẫn bán được.',
      'Bấm vào món ở giữa, chọn size/topping/số lượng rồi “Thêm vào order”.',
      'Phiếu order bên phải tự cộng tiền theo từng món.',
      'Bấm “Thanh toán” khi khách xong để chốt đơn.',
    ],
    img: '/product/pos-full.png',
    imgLabel: 'Màn hình bán hàng FunCafe',
  },
  {
    id: 'thanh-toan',
    icon: Receipt,
    title: '5. Thanh toán & hóa đơn',
    intro: 'Ba cách thu tiền: tiền mặt, VietQR và cổng VNPay. Hóa đơn lưu lại đầy đủ.',
    steps: [
      'Trong phiếu order, bấm “Thanh toán” và chọn cách trả.',
      'Tiền mặt: nhập số tiền khách đưa, hệ thống tính sẵn tiền thối.',
      'VietQR: khách quét mã chuyển thẳng vào tài khoản quán; bạn mở app ngân hàng xem tiền đã về rồi bấm xác nhận.',
      'VNPay: khách quét mã và trả trên cổng bằng điện thoại của họ. Đơn TỰ CHỐT khi cổng báo về, màn hình tự chuyển sang phiếu thành công — không có nút xác nhận tay, vì tiền VNPay không hiện ở đâu để quầy kiểm.',
      'Thu xong bấm “In phiếu” ngay trên màn Bán hàng để in cho khách.',
      'Cần in lại thì vào mục “Hóa đơn”, mở tờ cũ ra in bất cứ lúc nào.',
    ],
    img: '/product/invoices.png',
    imgLabel: 'Tra cứu và in lại hóa đơn',
  },
  {
    id: 'doanh-thu',
    icon: BarChart3,
    title: '6. Doanh thu & báo cáo',
    intro: 'Theo dõi doanh thu theo ngày/tháng/năm và món bán chạy.',
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
    id: 'nhan-vien',
    icon: Users,
    title: '7. Tài khoản nhân viên',
    intro: 'Giao ca cho nhân viên mà không phải đưa tài khoản chủ quán cho họ.',
    steps: [
      'Vào “Quản lý nhân viên”, bấm “Thêm nhân viên”.',
      'Nhập họ tên, email đăng nhập và mật khẩu ban đầu rồi đưa cho nhân viên.',
      'Nhân viên đăng nhập ở cùng trang đăng nhập, nhưng chỉ thấy Bán hàng, Hóa đơn và Hồ sơ cá nhân.',
      'Nhân viên KHÔNG tự đổi mật khẩu được — bạn bấm biểu tượng chìa khóa để đặt lại giúp họ.',
      'Người nghỉ việc thì bấm khóa. Họ không đăng nhập được nữa, nhưng hóa đơn cũ vẫn giữ nguyên tên người thu.',
      'Số nhân viên tùy theo gói: Fun Free và Pro được 2, Pro Max không giới hạn.',
    ],
    img: '/product/staff.png',
    imgLabel: 'Danh sách nhân viên của quán',
  },
  {
    id: 'goi',
    icon: CreditCard,
    title: '8. Gói dịch vụ',
    intro: 'Bắt đầu miễn phí, nâng cấp khi quán cần thêm tính năng. Mỗi quán có gói riêng.',
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/70 mb-3">Mục lục</p>
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
            <p className="text-xs text-ink/70 mb-3">Đội ngũ FunCafe sẵn sàng hỗ trợ bạn.</p>
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

              {/* Mục có ảnh: các bước bên trái, ảnh bên phải — trước đây ảnh nằm dưới
                  và bị giới hạn max-w-xl nên cả cột phải trống hoác trên màn rộng. */}
              <div className={s.img ? 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:items-start' : ''}>
                <ol className="space-y-3">
                  {s.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3.5">
                      <span className="w-7 h-7 rounded-full bg-bean text-white grid place-items-center text-sm font-bold shrink-0">{idx + 1}</span>
                      <p className="text-ink/80 leading-relaxed pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>

                {s.img && (
                  <div className="relative min-w-0">
                    <div aria-hidden className="absolute -inset-4 rounded-[2rem] bg-bean/8 blur-2xl" />
                    <AppShot src={s.img} alt={s.imgLabel ?? s.title} label={s.imgLabel} maxH="max-h-[26rem]" />
                  </div>
                )}
              </div>

              {i < sections.length - 1 && <div className="mt-14 md:mt-20 border-t border-line" />}
            </Reveal>
          ))}

          {/* Đánh giá FunCafe — chủ quán góp ý về sản phẩm (dời từ trang gói sang) */}
          <FunCafeReviewSection />
        </div>
      </div>

      {/* CTA cuối — dùng chung một kiểu với các trang public khác */}
      <CtaPanel
        title="Sẵn sàng bắt đầu?"
        subtitle="Tạo tài khoản và làm theo hướng dẫn — chỉ vài phút là quán bạn bán được hàng."
        note="7 ngày miễn phí · Không cần thẻ tín dụng"
      />
    </PublicLayout>
  );
}
