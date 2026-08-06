// Logo thương hiệu cổng thanh toán (tái dựng bằng SVG theo đúng màu nhận diện).
// Lưu ý: đây là bản dựng lại theo màu thương hiệu để hiển thị đúng thực tế;
// nếu cần logo chính hãng pixel-perfect, thả file .svg chính thức vào /public rồi dùng <img>.

/** Wordmark VNPAY — "VN" đỏ + "PAY" xanh (màu nhận diện VNPAY). */
export function VnpayLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 104 28" className={className} role="img" aria-label="VNPAY" xmlns="http://www.w3.org/2000/svg">
      <text
        x="0"
        y="22"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="24"
        letterSpacing="-0.5"
      >
        <tspan fill="#EC1C24">VN</tspan>
        <tspan fill="#005AAB">PAY</tspan>
      </text>
    </svg>
  );
}

/** Wordmark MoMo — chữ "momo" trên nền bo tròn hồng cánh sen (#A50064). */
export function MomoLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 28" className={className} role="img" aria-label="MoMo" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="96" height="28" rx="7" fill="#A50064" />
      <text
        x="48"
        y="20"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="17"
        letterSpacing="-0.3"
        fill="#FFFFFF"
      >
        momo
      </text>
    </svg>
  );
}

/** Icon QR kiểu VietQR — ba ô định vị xanh + khối dữ liệu đỏ (màu NAPAS/VietQR). */
export function VietQrMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="VietQR" xmlns="http://www.w3.org/2000/svg" fill="none">
      {/* Ba ô định vị (finder) — xanh */}
      <rect x="2" y="2" width="7" height="7" rx="1.4" stroke="#0A3D91" strokeWidth="2" />
      <rect x="15" y="2" width="7" height="7" rx="1.4" stroke="#0A3D91" strokeWidth="2" />
      <rect x="2" y="15" width="7" height="7" rx="1.4" stroke="#0A3D91" strokeWidth="2" />
      <rect x="4.6" y="4.6" width="1.8" height="1.8" fill="#0A3D91" />
      <rect x="17.6" y="4.6" width="1.8" height="1.8" fill="#0A3D91" />
      <rect x="4.6" y="17.6" width="1.8" height="1.8" fill="#0A3D91" />
      {/* Khối dữ liệu — đỏ */}
      <rect x="14.5" y="14.5" width="3" height="3" rx="0.4" fill="#E4002B" />
      <rect x="19" y="19" width="3" height="3" rx="0.4" fill="#E4002B" />
      <rect x="19" y="14.5" width="2" height="2" fill="#E4002B" />
      <rect x="14.5" y="19" width="2" height="2" fill="#E4002B" />
    </svg>
  );
}

// Không còn VietQrLogo(): mã QR thanh toán dựng bằng ảnh từ img.vietqr.io
// (xem buildVietQrUrl trong src/lib/banks.ts), ảnh đó đã có sẵn thương hiệu VietQR.
