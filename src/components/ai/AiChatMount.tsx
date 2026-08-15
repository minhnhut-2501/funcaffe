'use client';
import { usePathname } from 'next/navigation';
import AiChatWidget from './AiChatWidget';

/**
 * Quyết định trang nào được gắn hộp chat, đặt ở layout gốc.
 *
 * Không gắn thẳng `<AiChatWidget />` vào layout gốc vì hai lý do:
 *  - UserLayout đã tự gắn một cái rồi; thêm ở gốc nữa là hai nút chồng lên nhau.
 *  - Ở trang đăng nhập / đăng ký, một nút nổi mời tư vấn chỉ tổ che nút bấm chính.
 */
const KHU_DA_CO_SAN = ['/user'];
const KHU_KHONG_GAN = ['/admin', '/login', '/register', '/forgot-password', '/reset-password'];

export default function AiChatMount() {
  const pathname = usePathname() ?? '';

  const an = [...KHU_DA_CO_SAN, ...KHU_KHONG_GAN].some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  return an ? null : <AiChatWidget />;
}
