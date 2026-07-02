import Link from 'next/link';
import { Coffee, Check } from 'lucide-react';

/**
 * Panel ảnh bên cạnh form đăng nhập/đăng ký (split-screen).
 * Ảnh quán cafe + lớp phủ gradient xanh dương thương hiệu + thông điệp trắng.
 * Ẩn ở mobile (form là nội dung chính) — ảnh mang tính trang trí nên alt="".
 */
export default function AuthAside({
  image,
  title,
  subtitle,
  points,
}: {
  image: string;
  title: string;
  subtitle: string;
  points: string[];
}) {
  return (
    <div className="relative hidden md:flex flex-col justify-between overflow-hidden h-full min-h-[560px] p-8 lg:p-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" loading="eager" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-bean/92 via-bean/80 to-bean-dark/85" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0B1220]/55 via-transparent to-transparent" />

      {/* Logo */}
      <Link href="/" className="relative z-10 inline-flex items-center gap-2 w-fit">
        <span className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center ring-1 ring-white/25">
          <Coffee className="w-5 h-5 text-white" />
        </span>
        <span className="text-lg font-bold text-white">FunCafe</span>
      </Link>

      {/* Thông điệp */}
      <div className="relative z-10">
        <h2 className="text-2xl lg:text-3xl font-bold text-white leading-snug mb-3 [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">
          {title}
        </h2>
        <p className="text-white/85 leading-relaxed mb-6 max-w-sm">{subtitle}</p>
        <ul className="space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-white/90">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-white/20 grid place-items-center shrink-0 ring-1 ring-white/25">
                <Check className="w-3 h-3 text-white" />
              </span>
              <span className="text-sm leading-relaxed">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
