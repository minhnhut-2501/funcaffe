import UserLayout from '@/components/layouts/UserLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <UserLayout>{children}</UserLayout>;
}
