/**
 * Banner ảnh dùng chung cho các trang public.
 * Ảnh nền + lớp phủ (.photo-tint) + tiêu đề có đổ bóng (.banner-title) để chữ trắng
 * luôn đọc rõ trên mọi ảnh (WCAG AA). Không dùng hook -> an toàn ở Server Component.
 *
 * KHÔNG dùng `Reveal` cho chữ ở đây: banner luôn nằm trên nếp gấp, mà Reveal cố ý bỏ
 * qua những gì đã hiện sẵn (để bot và trình duyệt không chạy JS vẫn thấy nội dung).
 * Hệ quả là banner chưa bao giờ có lấy một chuyển động nào lúc mở trang — đúng cái
 * cảm giác "đứng im lìm". Thay bằng `.dan-canh`: animation CSS thuần, vào so le,
 * không chặn gì, và vẫn hiện đủ nội dung nếu animation không chạy.
 */
export default function Banner({
  image,
  alt,
  title,
  subtitle,
  align = 'center',
  size = 'lg',
  titleAs = 'h1',
  priority = false,
  children,
}: {
  image: string;
  alt: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'center' | 'left';
  size?: 'lg' | 'md';
  titleAs?: 'h1' | 'h2';
  priority?: boolean;
  children?: React.ReactNode;
}) {
  const Title = titleAs;
  const pad = size === 'lg' ? 'py-20 md:py-28' : 'py-14 md:py-16';
  const titleSize =
    size === 'lg'
      ? 'text-3xl md:text-5xl tracking-tight'
      : 'text-2xl md:text-3xl';

  return (
    <section className="relative overflow-hidden photo-tint">
      <img
        src={image}
        srcSet={`${image.replace(/\.jpg$/, '-900w.jpg')} 900w, ${image} 1600w`}
        sizes="100vw"
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        // `anh-troi`: trôi rất chậm để khung hero có sự sống thay vì đứng chết như
        // ảnh dán. Biên độ nhỏ nên chữ đè lên trên không bị xê dịch theo.
        // `.photo-tint` phủ tới 0.86 nên ảnh gốc gần như chìm hẳn — đó mới là lý do
        // banner nhìn nhạt: KHÔNG PHẢI thiếu lớp phủ, mà là quán shop không còn nhìn
        // thấy được. Đẩy sáng và tăng độ rực để cảnh quán xuyên qua được lớp phủ,
        // thay vì chồng thêm một lớp tối nữa (đã thử, ra một dải gần như đen).
        className="anh-troi absolute inset-0 w-full h-full object-cover brightness-125 saturate-[1.35] contrast-[1.08]"
      />

      {/* Vệt sáng chéo tĩnh, gợi ánh đèn hắt trong quán — tạo chiều sâu mà không
          cướp mất độ sáng vừa lấy lại ở trên. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(115deg,transparent_18%,rgba(255,255,255,0.10)_44%,transparent_66%)]"
      />
      {/* Cùng hoạ tiết chấm với .bg-paper-textured của các section sáng, để banner
          thuộc về trang chứ không phải một tấm ảnh dán vào. */}
      <div aria-hidden className="absolute inset-0 bg-cham-toi opacity-50" />

      <div
        className={`relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${pad} ${
          align === 'center' ? 'text-center' : ''
        }`}
      >
        <div className={`dan-canh ${align === 'center' ? 'max-w-3xl mx-auto' : 'max-w-2xl'}`}>
          <Title className={`banner-title font-bold ${titleSize} mb-3 leading-tight text-balance`}>
            {title}
          </Title>
          {subtitle && (
            <p className="banner-sub text-white/95 text-base md:text-lg leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
