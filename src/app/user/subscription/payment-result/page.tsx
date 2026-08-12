'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { lyDoLoi } from '@/lib/payment-codes';

function Result() {
  const params = useSearchParams();
  const status = params.get('status');
  const code = params.get('code');
  // Cổng đã THU TIỀN nhưng hệ thống không cấp được gói. Khác hẳn thất bại thường:
  // tiền đã ra khỏi tài khoản khách, nên tuyệt đối KHÔNG được mời "thử lại" —
  // họ sẽ trả tiền lần hai. Backend đã ghi log mức error để đối soát.
  const paidButNotActivated = code === 'not_activated';
  // Cổng nào trả về — backend đính kèm ?gateway=vnpay|momo. Thiếu thì không nêu tên
  // cổng chứ không đoán bừa.
  const gatewayName = ({ vnpay: 'VNPay', momo: 'MoMo' } as Record<string, string>)[params.get('gateway') ?? ''] ?? '';
  const lyDo = lyDoLoi(code, params.get('gateway'));
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
              {gatewayName ? `Đã nhận thanh toán qua ${gatewayName}. ` : ''}Gói dịch vụ của bạn đã được kích hoạt tự động.
            </p>
            {refreshing && (
              <p className="text-xs text-cafe-400 flex items-center justify-center gap-1 mt-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Đang cập nhật thông tin gói...
              </p>
            )}
          </>
        ) : paidButNotActivated ? (
          <>
            <div className="w-16 h-16 rounded-full bg-gold/18 grid place-items-center mx-auto mb-4"><AlertTriangle className="w-9 h-9 text-gold-deep" /></div>
            <h1 className="text-xl font-bold text-ink mb-2">Đã nhận thanh toán, gói đang chờ kích hoạt</h1>
            <p className="text-sm text-cafe-600">
              {gatewayName ? `${gatewayName} báo giao dịch thành công` : 'Giao dịch đã thành công'}, nhưng hệ thống chưa kích hoạt được gói cho quán của bạn.
            </p>
            <p className="text-sm font-semibold text-ink mt-3">
              Vui lòng <strong>không thanh toán lại</strong> — bạn sẽ bị trừ tiền lần nữa.
            </p>
            <p className="text-sm text-cafe-600 mt-2">
              Giao dịch đã được ghi nhận. Hãy liên hệ với chúng tôi kèm mã giao dịch của ngân hàng để được kích hoạt.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 grid place-items-center mx-auto mb-4"><XCircle className="w-9 h-9 text-red-500" /></div>
            <h1 className="text-xl font-bold text-ink mb-2">Thanh toán không thành công</h1>
            <p className="text-sm text-cafe-600">
              {lyDo ?? `Giao dịch ${gatewayName ? `qua ${gatewayName} ` : ''}chưa hoàn tất hoặc đã bị hủy. Bạn có thể thử lại.`}
            </p>
            <p className="text-sm text-cafe-600 mt-2">Chưa có khoản tiền nào bị trừ cho gói này.</p>
            {code && <p className="text-xs text-cafe-400 mt-3">Mã lỗi{gatewayName && ` từ ${gatewayName}`}: {code}</p>}
          </>
        )}

        <div className="mt-6 flex gap-2 justify-center">
          {paidButNotActivated ? (
            <Link href="/contact" className="btn-primary">Liên hệ hỗ trợ</Link>
          ) : (
            <Link href="/user/subscription" className="btn-primary">Về trang gói dịch vụ</Link>
          )}
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
