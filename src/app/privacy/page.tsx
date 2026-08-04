import type { Metadata } from 'next';
import LegalPage from '@/components/public/LegalPage';
import { sections, UPDATED_AT } from './content';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật — FunCafe',
  description: 'FunCafe thu thập dữ liệu gì, dùng để làm gì, chia sẻ với ai và bạn có quyền gì với dữ liệu của mình.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      badge="Pháp lý"
      title="Chính sách bảo mật"
      subtitle="Dữ liệu nào được thu thập, gửi đi đâu và bạn kiểm soát được những gì — mô tả đúng theo cách hệ thống đang chạy."
      updatedAt={UPDATED_AT}
      sections={sections}
    />
  );
}
