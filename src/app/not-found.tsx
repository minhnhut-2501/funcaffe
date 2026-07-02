import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cafe-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl font-bold text-cafe-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-cafe-800 mb-2">Trang không tồn tại</h1>
        <p className="text-cafe-500 mb-6">Trang bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
        <Link href="/" className="btn-primary">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
