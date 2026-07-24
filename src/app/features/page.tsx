import PublicLayout from '@/components/layouts/PublicLayout';
import Reveal from '@/components/public/Reveal';
import Banner from '@/components/public/Banner';
import AppShot from '@/components/public/AppShot';
import CtaPanel from '@/components/public/CtaPanel';
import Link from 'next/link';
import {
  Store, UtensilsCrossed, ShoppingCart, Receipt, BarChart3, Sparkles,
  ShieldCheck, CreditCard, Building2, ArrowRight,
} from 'lucide-react';

/**
 * Trang Tính năng — bố cục "từng chương": mỗi nhóm chức năng có ảnh chụp THẬT cỡ lớn
 * kèm danh sách chi tiết bên dưới. Cố ý khác nhịp với trang chủ (zigzag ngắn gọn):
 * ở đây người xem đã quan tâm nên cần đầy đủ, không phải chào hàng.
 */

type Feature = { name: string; desc: string };
type Chapter = {
  id: string;
  icon: typeof Store;
  nav: string;
  title: string;
  blurb: string;
  img: string;
  imgLabel: string;
  features: Feature[];
};

const chapters: Chapter[] = [
  {
    id: 'quan-va-ban',
    icon: Store,
    nav: 'Quán & bàn',
    title: 'Khai báo quán một lần, mọi thứ xoay quanh sơ đồ bàn',
    blurb:
      'Thiết lập ban đầu chỉ mất vài phút. Sau đó mỗi ca làm việc, bạn chỉ cần nhìn vào sơ đồ bàn là biết quán đang chạy thế nào.',
    img: '/product/tables.png',
    imgLabel: 'FunCafe · Quản lý bàn',
    features: [
      { name: 'Thông tin quán', desc: 'Tên quán, địa chỉ, số điện thoại, mô tả và logo — dùng lại trên hóa đơn in cho khách.' },
      { name: 'Tài khoản nhận tiền', desc: 'Lưu số tài khoản ngân hàng của quán để hệ thống sinh mã VietQR đúng người nhận.' },
      { name: 'Thêm và sắp xếp bàn', desc: 'Tạo bàn theo đúng sơ đồ thật của quán, đặt tên và số chỗ ngồi cho từng bàn.' },
      { name: 'Trạng thái tự đổi', desc: 'Bàn chuyển sang “Đang phục vụ” khi có order và tự về “Trống” sau khi thanh toán xong.' },
      { name: 'Lọc theo trạng thái', desc: 'Lúc quán đông, lọc riêng bàn trống hoặc bàn đang phục vụ để khỏi phải dò cả danh sách.' },
      { name: 'Nhiều quán một tài khoản', desc: 'Nếu bạn có hơn một quán, chuyển qua lại ngay trên thanh trên cùng mà không cần đăng xuất.' },
    ],
  },
  {
    id: 'thuc-don',
    icon: UtensilsCrossed,
    nav: 'Thực đơn',
    title: 'Thực đơn có ảnh, có size, có topping — nhân viên mới vẫn chọn đúng',
    blurb:
      'Phần lớn nhầm lẫn khi order đến từ thực đơn rối. Ở đây món được chia nhóm, có ảnh và giá theo từng size nên chọn bằng mắt là ra.',
    img: '/product/menu.png',
    imgLabel: 'FunCafe · Thực đơn',
    features: [
      { name: 'Danh mục món', desc: 'Chia thực đơn theo nhóm (cà phê, trà sữa, bánh ngọt…) để lọc nhanh khi đang bán.' },
      { name: 'Ảnh cho từng món', desc: 'Tải ảnh món lên; ở màn bán hàng nhân viên nhìn ảnh là biết ngay, không phải đọc tên.' },
      { name: 'Nhiều size, giá riêng', desc: 'Một món có thể có S/M/L với giá khác nhau, chọn size nào phiếu order tính đúng giá đó.' },
      { name: 'Kho topping dùng chung', desc: 'Quản lý danh sách topping và giá ở một nơi, sửa một lần áp dụng mọi món.' },
      { name: 'Topping theo từng món', desc: 'Chỉ định topping nào được phép dùng cho món nào, tránh chọn nhầm kiểu “trân châu cho cà phê”.' },
      { name: 'Bật tắt còn bán', desc: 'Hết nguyên liệu giữa ca thì tắt món, món lập tức ẩn khỏi màn bán hàng.' },
      { name: 'Tìm món tức thì', desc: 'Gõ vài chữ là ra món, hữu ích khi thực đơn dài và khách đang đứng đợi.' },
    ],
  },
  {
    id: 'ban-hang',
    icon: ShoppingCart,
    nav: 'Bán hàng',
    title: 'Ba cột trên một màn hình: bàn, thực đơn và phiếu order',
    blurb:
      'Toàn bộ thao tác bán hàng nằm gọn trong một màn, không phải nhảy qua lại giữa các trang. Đây là màn hình nhân viên dùng nhiều nhất.',
    img: '/product/pos-full.png',
    imgLabel: 'FunCafe · Bán hàng',
    features: [
      { name: 'Order theo bàn', desc: 'Mở order cho bàn khách đang ngồi; quay lại thêm món bất cứ lúc nào trước khi thanh toán.' },
      { name: 'Chọn size, topping, số lượng', desc: 'Mỗi lần thêm món đều chọn được size, topping và số lượng trong cùng một hộp thoại.' },
      { name: 'Ghi chú riêng từng dòng', desc: 'Ghi “ít đá”, “không đường” cho đúng dòng món đó, không lẫn với món khác trong bàn.' },
      { name: 'Sửa lại dòng đã thêm', desc: 'Khách đổi ý thì bấm vào dòng trong phiếu để đổi size, topping hoặc ghi chú.' },
      { name: 'Ảnh món trong phiếu', desc: 'Mỗi dòng order hiện ảnh món để soát lại phiếu bằng mắt trước khi pha.' },
      { name: 'Tự cộng tiền', desc: 'Tiền món, tiền size và tiền topping được cộng lại ngay khi bạn bấm, không tính tay.' },
      { name: 'Hủy order', desc: 'Lỡ lên nhầm cả phiếu thì hủy một lần, bàn tự trả về trạng thái trống.' },
    ],
  },
  {
    id: 'thanh-toan',
    icon: Receipt,
    nav: 'Thanh toán',
    title: 'Thanh toán tiền mặt hay QR, hóa đơn đều được lưu lại',
    blurb:
      'Khách trả kiểu nào cũng xong trong vài giây, và mọi hóa đơn đều tra cứu lại được — không còn cảnh lục tập giấy cuối tháng.',
    img: '/product/invoices.png',
    imgLabel: 'FunCafe · Hóa đơn',
    features: [
      { name: 'Tiền mặt có tính tiền thối', desc: 'Nhập số tiền khách đưa, hệ thống tính sẵn số tiền phải trả lại.' },
      { name: 'VietQR', desc: 'Sinh mã QR theo tài khoản ngân hàng của quán kèm đúng số tiền, khách quét là chuyển.' },
      { name: 'Hóa đơn đầy đủ', desc: 'Mỗi lần thanh toán tạo một hóa đơn có mã riêng, thời gian và chi tiết từng món.' },
      { name: 'Lọc và tra cứu', desc: 'Tìm lại hóa đơn theo khoảng ngày và theo phương thức thanh toán.' },
      { name: 'In hóa đơn', desc: 'In thẳng từ trình duyệt ra máy in nhiệt hoặc máy in thường của quán.' },
      { name: 'Tải PDF', desc: 'Lưu hóa đơn thành file PDF để gửi cho khách hoặc giữ lại làm chứng từ.' },
    ],
  },
  {
    id: 'doanh-thu',
    icon: BarChart3,
    nav: 'Doanh thu',
    title: 'Cuối ngày không phải ngồi cộng lại sổ',
    blurb:
      'Số liệu được tổng hợp sẵn từ chính các hóa đơn đã thanh toán, nên mở lên là thấy, không cần nhập lại lần nào.',
    img: '/product/revenue.png',
    imgLabel: 'FunCafe · Doanh thu',
    features: [
      { name: 'Bốn chỉ số nhanh', desc: 'Doanh thu hôm nay, doanh thu tháng này, tổng số hóa đơn và trung bình mỗi hóa đơn.' },
      { name: 'Biểu đồ ngày / tháng / năm', desc: 'Đổi chế độ xem để nhìn biến động ngắn hạn hoặc xu hướng cả năm.' },
      { name: 'Lọc theo khoảng ngày', desc: 'Chọn từ ngày đến ngày để xem đúng giai đoạn bạn quan tâm, ví dụ một đợt khuyến mãi.' },
      { name: 'Top 5 món bán chạy', desc: 'Biết món nào thật sự kéo doanh thu để cân đối lại thực đơn và nguyên liệu.' },
      { name: 'Xuất Excel', desc: 'Tải số liệu về máy để làm báo cáo, đối chiếu sổ sách hoặc nộp cho kế toán.' },
    ],
  },
];

const aiFeatures: Feature[] = [
  { name: 'Hỏi đáp bằng tiếng Việt', desc: 'Hỏi “doanh thu hôm nay bao nhiêu”, “còn mấy bàn trống” và nhận câu trả lời dựa trên số liệu thật của quán bạn.' },
  { name: 'Gợi ý combo và khuyến mãi', desc: 'Trợ lý đọc thực đơn thật rồi đề xuất combo kèm mức giá, không phải gợi ý chung chung.' },
  { name: 'Phân tích doanh thu tự động', desc: 'Một cú bấm để nhận ba phần: điểm nổi bật, cảnh báo bất thường và gợi ý hành động cụ thể.' },
];

const extras = [
  {
    icon: ShieldCheck,
    title: 'Tài khoản & bảo mật',
    items: [
      'Đăng ký và đăng nhập bằng email',
      'Ghi nhớ đăng nhập trên máy quen',
      'Đổi mật khẩu trong hồ sơ cá nhân',
      'Quên mật khẩu: nhận liên kết đặt lại qua email',
    ],
  },
  {
    icon: CreditCard,
    title: 'Gói dịch vụ',
    items: [
      'Xem gói đang dùng và số ngày còn lại',
      'Nâng cấp online, thanh toán qua VNPay',
      'Chọn thời hạn 1, 3 hoặc 12 tháng',
      'Nâng cấp giữa kỳ được hoàn phần thời gian còn lại theo tỷ lệ',
    ],
  },
  {
    icon: Building2,
    title: 'Vận hành hằng ngày',
    items: [
      'Trang tổng quan với lối tắt tới việc hay dùng',
      'Chuyển nhanh giữa các quán bạn quản lý',
      'Cập nhật hồ sơ và ảnh đại diện',
      'Dùng được trên máy tính, máy tính bảng và điện thoại',
    ],
  },
];

function ChapterBlock({ c, index }: { c: Chapter; index: number }) {
  const alt = index % 2 === 1;
  // overflow-x-clip: quầng sáng -inset-6 quanh ảnh tràn 8px ra ngoài màn 390px
  return (
    <section id={c.id} className={`scroll-mt-32 border-t border-line overflow-x-clip ${alt ? 'bg-paper-textured' : 'bg-white'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <Reveal className="max-w-2xl mb-8 md:mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-11 h-11 rounded-xl bg-bean-tint text-bean grid place-items-center shrink-0">
              <c.icon className="w-5 h-5" aria-hidden />
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-ink leading-snug">{c.title}</h2>
          </div>
          <p className="text-ink/75 leading-relaxed">{c.blurb}</p>
        </Reveal>

        <Reveal delay={100} className="relative mb-10 md:mb-12">
          <div aria-hidden className="absolute -inset-6 rounded-[2.5rem] bg-bean/8 blur-3xl" />
          <AppShot src={c.img} alt={`Màn hình ${c.nav} của FunCafe`} label={c.imgLabel} />
        </Reveal>

        <Reveal delay={140}>
          <dl className="grid sm:grid-cols-2 gap-x-10 lg:gap-x-16">
            {c.features.map((f) => (
              <div key={f.name} className="border-t border-line py-4">
                <dt className="font-semibold text-ink">{f.name}</dt>
                <dd className="text-sm text-ink/70 leading-relaxed mt-1">{f.desc}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <PublicLayout>
      <Banner
        image="/banners/cafe-interior.jpg"
        alt="Không gian bên trong một quán cafe"
        title="Tất cả những gì FunCafe làm được"
        subtitle="Từ khai báo bàn và thực đơn, bán hàng tại quầy, thanh toán, hóa đơn cho tới báo cáo doanh thu và trợ lý AI — đầy đủ trong một hệ thống."
        align="center"
        size="lg"
        priority
      />

      {/* Mục lục ngang: trang dài nên cần đường tắt tới đúng nhóm chức năng */}
      <nav
        aria-label="Nhóm chức năng"
        className="sticky top-16 z-sticky bg-white/90 backdrop-blur-md border-b border-line"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ul className="flex gap-2 overflow-x-auto no-scrollbar py-3">
            {chapters.map((c) => (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink/75 transition-colors hover:border-bean hover:text-bean"
                >
                  <c.icon className="w-4 h-4 text-bean" aria-hidden />
                  {c.nav}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#tro-ly-ai"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-bean px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-bean-dark"
              >
                <Sparkles className="w-4 h-4" aria-hidden />
                Trợ lý AI
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {chapters.map((c, i) => (
        <ChapterBlock key={c.id} c={c} index={i} />
      ))}

      {/* Trợ lý AI — tách riêng vì đây là chức năng chỉ gói Pro Max mới có */}
      <section id="tro-ly-ai" className="scroll-mt-32 bg-bean-tint border-y border-bean/15 overflow-x-clip">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bean px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="w-3.5 h-3.5" aria-hidden /> Chỉ có ở gói Pro Max
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-ink mt-4 mb-3 leading-snug">
              Trợ lý AI đọc được dữ liệu của chính quán bạn
            </h2>
            <p className="text-ink/75 leading-relaxed mb-7 max-w-md">
              Khác với chatbot thường, trợ lý này truy cập bàn, thực đơn, hóa đơn và doanh thu
              thật của quán, nên trả lời bằng chính con số và tên món bạn đang bán.
            </p>
            <dl className="mb-7">
              {aiFeatures.map((f) => (
                <div key={f.name} className="border-t border-bean/20 py-4">
                  <dt className="font-semibold text-ink">{f.name}</dt>
                  <dd className="text-sm text-ink/75 leading-relaxed mt-1">{f.desc}</dd>
                </div>
              ))}
            </dl>
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-bean font-semibold hover:underline text-sm">
              Xem gói Pro Max <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </Reveal>

          <Reveal delay={120} className="relative flex justify-center lg:justify-end">
            <div aria-hidden className="absolute -inset-8 rounded-[3rem] bg-bean/10 blur-3xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/product/ai-chat.png"
              alt="Hộp thoại trợ lý AI của FunCafe đang gợi ý các combo đồ uống kèm giá cho buổi chiều vắng khách"
              className="relative w-full max-w-[340px] rounded-2xl border border-line bg-white"
              style={{ boxShadow: '0 34px 80px -34px rgba(15,23,42,0.45)' }}
              loading="lazy"
            />
          </Reveal>
        </div>
      </section>

      {/* Những phần nhỏ nhưng vẫn phải có */}
      <section className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <Reveal className="max-w-2xl mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-3">Những phần nhỏ nhưng vẫn phải có</h2>
            <p className="text-ink/75">Không phải chức năng để khoe, nhưng thiếu thì dùng hằng ngày sẽ vướng.</p>
          </Reveal>
          <div className="grid gap-8 md:grid-cols-3 md:gap-12">
            {extras.map((g, i) => (
              <Reveal key={g.title} delay={i * 80}>
                <div className="flex items-center gap-2.5 mb-4">
                  <g.icon className="w-5 h-5 text-bean" aria-hidden />
                  <h3 className="font-bold text-ink">{g.title}</h3>
                </div>
                <ul className="space-y-3">
                  {g.items.map((it) => (
                    <li key={it} className="border-t border-line pt-3 text-sm text-ink/75 leading-relaxed">
                      {it}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200} className="mt-12 rounded-2xl border border-line bg-paper p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <p className="text-ink/80 leading-relaxed max-w-xl">
              Gói Fun Free cho dùng thử <strong className="font-semibold text-ink">toàn bộ</strong> chức năng
              trong 7 ngày. Sau đó gói Pro giới hạn số bàn và số món, gói Pro Max mở lại không giới hạn kèm trợ lý AI.
            </p>
            <Link href="/pricing" className="btn-cafe shrink-0">
              So sánh ba gói <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      <CtaPanel
        title="Sẵn sàng thử trên quán của bạn?"
        subtitle="Tạo tài khoản và dùng thử miễn phí 7 ngày, không cần thẻ tín dụng."
        note="Không giới hạn bàn và món trong thời gian dùng thử"
      />
    </PublicLayout>
  );
}
