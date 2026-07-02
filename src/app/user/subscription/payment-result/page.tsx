'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function Result() {
  const params = useSearchParams();
  const status = params.get('status');
  const code = params.get('code');
  const { refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(true);

  const success = status === 'success';

  useEffect(() => {
    // Cập nhật lại trạng thái gói sau khi cổng thanh toán trả về
    (async () => {
      if (success && refreshUser) {
        try { await refreshUser(); } catch { /* ignore */ }
      }
      setRefreshing(false);
    })();
  }, [success, refreshUser]);

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="card-funcafe text-center py-10 px-6">
        {success ? (
          <>
            <div className="w-16 h-16 rounded-full bg-pine/12 grid place-items-center mx-auto mb-4"><CheckCircle2 className="w-9 h-9 text-pine" /></div>
            <h1 className="text-xl font-bold text-ink mb-2">Thanh toán thành công</h1>
            <p className="text-sm text-cafe-600 mb-1">
              Gói dịch vụ của bạn đã được kích hoạt tự động.
            </p>
            {refreshing && (
              <p className="text-xs text-cafe-400 flex items-center justify-center gap-1 mt-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Đang cập nhật thông tin gói...
              </p>
            )}
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 grid place-items-center mx-auto mb-4"><XCircle className="w-9 h-9 text-red-500" /></div>
            <h1 className="text-xl font-bold text-ink mb-2">Thanh toán không thành công</h1>
            <p className="text-sm text-cafe-600">
              Giao dịch chưa hoàn tất hoặc đã bị hủy. Bạn có thể thử lại.
            </p>
            {code && <p className="text-xs text-cafe-400 mt-2">Mã lỗi: {code}</p>}
          </>
        )}

        <div className="mt-6 flex gap-2 justify-center">
          <Link href="/user/subscription" className="btn-primary">Về trang gói dịch vụ</Link>
          {!success && <Link href="/user/dashboard" className="btn-secondary">Về trang chủ</Link>}
        </div>
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={<div className="text-center mt-10 text-cafe-500">Đang xử lý kết quả thanh toán...</div>}>
      <Result />
    </Suspense>
  );
}
