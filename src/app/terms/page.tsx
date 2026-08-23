import type { Metadata } from 'next';
import LegalPage from '@/components/public/LegalPage';
import { sections, UPDATED_AT } from './content';

export const metadata: Metadata = {
  title: 'Điều khoản dịch vụ — FunCafe',
  description: 'Quy tắc sử dụng phần mềm quản lý quán shop FunCafe: tài khoản, gói dịch vụ, thanh toán và trách nhiệm của các bên.',
};

// Server component: trang này không có state nào, nhờ vậy khai báo được `metadata`.
// PublicLayout bên trong là client component — nhận children từ server component
// vẫn hợp lệ trong App Router.
export default function TermsPage() {
  return (
    <LegalPage
      badge="Pháp lý"
      title="Điều khoản dịch vụ"
      subtitle="Những quy tắc khi bạn dùng FunCafe để quản lý quán của mình — viết ngắn gọn, đúng với cách hệ thống đang hoạt động."
      updatedAt={UPDATED_AT}
      sections={sections}
    />
  );
}
