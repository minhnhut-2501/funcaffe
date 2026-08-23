import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import AiChatMount from '@/components/ai/AiChatMount';
import ApiProgressBar from '@/components/ui/ApiProgressBar';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

export const metadata: Metadata = {
  title: 'FunCafe - Nền tảng quản lý quán shop',
  description: 'Hệ thống quản lý quán shop thông minh dành cho chủ quán tại Việt Nam',
  // Khai báo SVG thôi là chưa đủ. Cốc Cốc, Zalo, lối tắt trên Desktop và nhiều trình
  // đọc liên kết KHÔNG đọc thẻ <link> — chúng đòi thẳng /favicon.ico ở gốc tên miền.
  // Thiếu tệp đó thì chúng ăn 404 rồi rơi về quả địa cầu mặc định, dù trang vẫn khai
  // báo icon đàng hoàng. Nên phải có CẢ HAI: .ico để tương thích, .svg để nét ở mọi cỡ.
  //
  // Cả hai sinh ra từ cùng public/favicon.svg bằng `node scripts/dung-icon.mjs` —
  // sửa logo thì sửa .svg rồi chạy lại, đừng vẽ tay tệp .ico kẻo hai bên trôi khỏi nhau.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={beVietnamPro.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {/* Đặt ở layout gốc để phủ CẢ BA khu — công khai, quản lý quán, quản trị.
              Nó không đọc gì từ React, chỉ nghe bộ đếm trong api-client, nên nằm đâu
              trong cây cũng được; ở đây là để chắc chắn không khu nào bị bỏ sót. */}
          <ApiProgressBar />
          {children}
          {/* Hộp chat tư vấn cho trang công khai. Nằm TRONG AuthProvider vì nó cần
              biết người đang xem đã đăng nhập chưa để chọn đúng tuyến và lời mời. */}
          <AiChatMount />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
