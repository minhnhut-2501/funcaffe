import Reveal from './Reveal';

/**
 * Banner ảnh dùng chung cho các trang public.
 * Ảnh nền + lớp phủ nâu đậm (.photo-tint) + tiêu đề có đổ bóng (.banner-title)
 * để chữ trắng luôn đọc rõ trên mọi ảnh (WCAG AA). Không dùng hook -> an toàn ở Server Component.
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
  const pad = size === 'lg' ? 'py-20 md:py-28' : 'py-14 md:py-16';
  const titleSize =
    size === 'lg'
      ? 'text-3xl md:text-5xl tracking-tight'
      : 'text-2xl md:text-3xl';

  return (
    <section className="relative overflow-hidden photo-tint">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div
        className={`relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${pad} ${
          align === 'center' ? 'text-center' : ''
        }`}
      >
        <div className={align === 'center' ? 'max-w-3xl mx-auto' : 'max-w-2xl'}>
          <Reveal as={titleAs} className={`banner-title font-bold ${titleSize} mb-3 leading-tight`}>
            {title}
          </Reveal>
          {subtitle && (
            <Reveal as="p" delay={80} className="banner-sub text-white/95 text-base md:text-lg leading-relaxed">
              {subtitle}
            </Reveal>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
