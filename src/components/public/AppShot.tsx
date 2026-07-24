/**
 * Khung "cửa sổ ứng dụng" bao ảnh chụp giao diện thật của FunCafe.
 * Dùng chung cho trang chủ và trang hỗ trợ (trước đây mỗi trang chép lại một bản
 * thanh tiêu đề giả với 3 chấm tròn).
 */
export default function AppShot({
  src,
  alt,
  label,
  className = '',
  priority = false,
  maxH,
}: {
  src: string;
  alt: string;
  label?: string;
  className?: string;
  priority?: boolean;
  /** Lớp giới hạn chiều cao, vd "max-h-[26rem]". Ảnh dài (danh sách bàn) sẽ được
   *  cắt bớt phần dưới thay vì kéo dài làm trống hẳn cột bên cạnh. */
  maxH?: string;
}) {
  return (
    <div
      className={`relative z-10 rounded-2xl border border-line bg-white overflow-hidden ${className}`}
      style={{ boxShadow: '0 34px 80px -34px rgba(15,23,42,0.45)' }}
    >
      <div aria-hidden className="flex items-center gap-1.5 px-3.5 h-8 bg-sand border-b border-line">
        <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-gold" />
        <span className="w-2.5 h-2.5 rounded-full bg-pine/60" />
        {label && <span className="ml-2 text-[10px] text-ink/70 font-medium truncate">{label}</span>}
      </div>
      <div className={maxH ? `${maxH} overflow-hidden` : ''}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={`block w-full ${maxH ? 'object-cover object-top h-full' : ''}`}
          loading={priority ? 'eager' : 'lazy'}
        />
      </div>
    </div>
  );
}
