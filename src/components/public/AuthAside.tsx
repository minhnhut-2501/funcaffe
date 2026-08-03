import Link from 'next/link';
import { Coffee, Check } from 'lucide-react';

/**
 * Panel ảnh bên cạnh form đăng nhập/đăng ký (split-screen).
 *
 * Lớp phủ dùng `.photo-tint` — cùng lớp scrim đã kiểm tương phản AA với các banner
 * ảnh khác của trang public. Trước đây panel này phủ xanh đặc tới 92% nên ảnh quán
 * gần như biến mất, chỉ còn một mảng xanh phẳng; giữ scrim chung vừa đọc rõ chữ vừa
 * thấy được ảnh thật.
 *
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
    <div className="photo-tint relative hidden md:flex flex-col justify-between overflow-hidden h-full min-h-[30rem] p-8 lg:p-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
      />

      <Link
        href="/"
        className="relative z-10 inline-flex items-center gap-2 w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <span className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center ring-1 ring-white/25">
          <Coffee className="w-5 h-5 text-white" />
        </span>
        <span className="text-lg font-bold text-white">FunCafe</span>
      </Link>

      <div className="relative z-10">
        <h2 className="banner-title text-2xl lg:text-3xl font-bold leading-snug mb-3">
          {title}
        </h2>
        <p className="banner-sub text-white/90 leading-relaxed mb-6 max-w-sm">{subtitle}</p>
        <ul className="space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-white">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-white/20 grid place-items-center shrink-0 ring-1 ring-white/30">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
              <span className="banner-sub text-sm leading-relaxed text-white/90">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
