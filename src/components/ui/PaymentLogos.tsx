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

/** Wordmark VietQR — icon QR + chữ "Viet" xanh, "QR" đỏ. */
export function VietQrLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 28" className={className} role="img" aria-label="VietQR" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0,3)">
        <rect x="1" y="1" width="6" height="6" rx="1.2" stroke="#0A3D91" strokeWidth="1.6" fill="none" />
        <rect x="12" y="1" width="6" height="6" rx="1.2" stroke="#0A3D91" strokeWidth="1.6" fill="none" />
        <rect x="1" y="12" width="6" height="6" rx="1.2" stroke="#0A3D91" strokeWidth="1.6" fill="none" />
        <rect x="12.5" y="12.5" width="2.4" height="2.4" fill="#E4002B" />
        <rect x="16" y="16" width="2.4" height="2.4" fill="#E4002B" />
      </g>
      <text x="26" y="21" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="22" letterSpacing="-0.5">
        <tspan fill="#0A3D91">Viet</tspan>
        <tspan fill="#E4002B">QR</tspan>
      </text>
    </svg>
  );
}
