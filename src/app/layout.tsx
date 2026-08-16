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
  title: 'FunCafe - Nền tảng quản lý quán cafe',
  description: 'Hệ thống quản lý quán cafe thông minh dành cho chủ quán tại Việt Nam',
  // public/favicon.svg vốn có sẵn nhưng không được khai báo, nên trình duyệt tự
  // đòi /favicon.ico và ăn 404 ở mọi lượt tải trang.
  icons: { icon: '/favicon.svg' },
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
