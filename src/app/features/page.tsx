import PublicLayout from '@/components/layouts/PublicLayout';
import Reveal from '@/components/public/Reveal';
import Banner from '@/components/public/Banner';
import { TableMapShot, MenuShot, OrderShot, ReportShot } from '@/components/public/FeatureShots';
import Link from 'next/link';
import { ShoppingCart, UtensilsCrossed, BarChart3, Store, Check } from 'lucide-react';

type Group = {
  title: string;
  icon: typeof Store;
  blurb: string;
  features: { name: string; desc: string }[];
  shot: React.ReactNode;
};

const groups: Group[] = [
  {
    title: 'Quản lý vận hành',
    icon: Store,
    blurb: 'Nắm tình hình cả quán trên một màn hình, không phải chạy đi hỏi từng bàn.',
    shot: <TableMapShot />,
    features: [
      { name: 'Thông tin quán', desc: 'Cập nhật tên quán, địa chỉ, số điện thoại, mô tả và logo.' },
      { name: 'Quản lý bàn', desc: 'Thêm, sửa, xóa bàn và sắp xếp theo sơ đồ thực tế của quán.' },
      { name: 'Trạng thái bàn', desc: 'Theo dõi bàn trống, đang phục vụ, đã đặt hay cần dọn.' },
    ],
  },
  {
    title: 'Quản lý thực đơn',
    icon: UtensilsCrossed,
    blurb: 'Món, size và topping được tổ chức gọn gàng nên nhân viên chọn nhanh, ít nhầm.',
    shot: <MenuShot />,
    features: [
      { name: 'Danh mục món', desc: 'Tổ chức thực đơn theo danh mục, tìm và lọc món nhanh.' },
      { name: 'Món có size', desc: 'Thêm nhiều size cho một món với giá riêng cho từng size.' },
      { name: 'Topping theo từng món', desc: 'Cấu hình topping nào được dùng cho món nào.' },
      { name: 'Trạng thái còn bán', desc: 'Bật/tắt tình trạng còn bán của món ngay trong ca.' },
    ],
  },
  {
    title: 'Bán hàng theo bàn',
    icon: ShoppingCart,
    blurb: 'Mở order theo bàn, thêm món, chọn size topping rồi thanh toán chỉ trong vài chạm.',
    shot: <OrderShot />,
    features: [
      { name: 'Chọn bàn', desc: 'Mở order theo bàn, tiếp tục order chưa thanh toán dễ dàng.' },
      { name: 'Thêm món', desc: 'Chọn món từ thực đơn và thêm vào order hiện tại.' },
      { name: 'Chọn size, topping', desc: 'Chọn size, topping, số lượng và ghi chú cho từng món.' },
      { name: 'Thanh toán', desc: 'Hỗ trợ tiền mặt, chuyển khoản, QR Code và ví điện tử.' },
      { name: 'In hóa đơn', desc: 'In hóa đơn sau khi thanh toán hoặc lưu lại file PDF.' },
    ],
  },
  {
    title: 'Báo cáo & doanh thu',
    icon: BarChart3,
    blurb: 'Biết quán đang lời lỗ ra sao, món nào bán chạy, mà không cần cộng tay. Có từ gói Pro trở lên.',
    shot: <ReportShot />,
    features: [
      { name: 'Doanh thu', desc: 'Xem doanh thu theo ngày, tháng và so sánh theo thời gian.' },
      { name: 'Hóa đơn', desc: 'Tra cứu lại hóa đơn theo ngày và phương thức thanh toán.' },
      { name: 'Top món bán chạy', desc: 'Biết món nào bán chạy để cân đối thực đơn.' },
      { name: 'Báo cáo chi tiết', desc: 'Tổng hợp số liệu để xem lại tình hình kinh doanh.' },
    ],
  },
];

function FeatureSplit({ g, flip }: { g: Group; flip: boolean }) {
  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
      <Reveal className={flip ? 'lg:order-2' : ''}>
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-xl bg-bean/10 flex items-center justify-center">
            <g.icon className="w-5 h-5 text-bean" />
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-ink">{g.title}</h2>
        </div>
        <p className="text-ink/70 leading-relaxed mb-6 max-w-xl">{g.blurb}</p>
        <ul className="space-y-3">
          {g.features.map((f) => (
            <li key={f.name} className="flex gap-3">
              <Check className="w-5 h-5 text-pine mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-ink">{f.name}</p>
                <p className="text-ink/60 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={120} className={`lift ${flip ? 'lg:order-1' : ''}`}>
        {g.shot}
      </Reveal>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <PublicLayout>
      {/* Hero banner ảnh thật */}
      <Banner
        image="/banners/cafe-interior.jpg"
        alt="Không gian bên trong một quán cafe"
        title="Tất cả công cụ để vận hành quán"
        subtitle="Từ quản lý bàn, thực đơn, bán hàng đến báo cáo doanh thu, mỗi chức năng đều được thiết kế cho người làm quán, không cần biết kỹ thuật."
        align="center"
        size="lg"
        priority
      />

      {/* 2 nhóm chức năng đầu (zigzag) */}
      <section className="bg-paper-textured">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-16 md:space-y-24">
          <FeatureSplit g={groups[0]} flip={false} />
          <FeatureSplit g={groups[1]} flip={true} />
        </div>
      </section>

      {/* Banner ngắt nhịp — ảnh thật */}
      <Banner
        image="/banners/coffee-cheers.jpg"
        alt="Những ly cà phê nâng lên chạm nhau"
        title="Một hệ thống, dùng được ngay trong ca đầu tiên"
        subtitle="Không cần tập huấn dài dòng, mở lên là bán."
        align="center"
        size="md"
        titleAs="h2"
      />

      {/* 2 nhóm chức năng sau (zigzag) */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-16 md:space-y-24">
          <FeatureSplit g={groups[2]} flip={false} />
          <FeatureSplit g={groups[3]} flip={true} />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-bean-dark text-white">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-20 text-center">
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Sẵn sàng thử trên quán của bạn?</h2>
            <p className="text-white/70 mb-7 max-w-xl mx-auto">Tạo tài khoản và dùng thử miễn phí, không cần thẻ tín dụng.</p>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-white text-bean hover:bg-paper active:translate-y-px px-7 py-3 rounded-lg text-base font-semibold transition-colors">
              Dùng thử miễn phí
            </Link>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
