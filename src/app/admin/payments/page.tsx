'use client';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { paymentService, userService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDateTime, formatDuration } from '@/lib/format';
import type { Payment, PaymentStatus, CreditStatus } from '@/types';
import { Eye, Lock, CreditCard } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge, { type Tone } from '@/components/user/StatusBadge';

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [packageFilter, setPackageFilter] = useState<string>('all');
  const [viewPayment, setViewPayment] = useState<Payment | null>(null);
  const [lockTarget, setLockTarget] = useState<Payment | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = () => paymentService.list().then(setPayments).catch(() => toast({ description: 'Không thể tải danh sách thanh toán', variant: 'destructive' }));
  useEffect(() => { load(); }, []);

  // Danh sách gói lấy từ chính dữ liệu giao dịch: luôn khớp với thứ đang hiển thị,
  // và không liệt kê gói chưa ai mua (lọc ra danh sách rỗng thì vô nghĩa).
  const packageNames = useMemo(
    () => [...new Set(payments.map(p => p.packageName).filter(Boolean))].sort(),
    [payments],
  );

  const filtered = payments.filter(p =>
    (packageFilter === 'all' || p.packageName === packageFilter) &&
    (p.userName.toLowerCase().includes(search.toLowerCase()) || p.transactionCode.toLowerCase().includes(search.toLowerCase()))
  );

  const handleLockToggle = async (p: Payment) => {
    setProcessing(true);
    try {
      await userService.toggleLock(p.userId);
      setLockTarget(null);
      toast({ description: `Đã thay đổi trạng thái người dùng ${p.userName}` });
    } catch {
      toast({ description: 'Thao tác thất bại', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const statusTone: Record<PaymentStatus, Tone> = {
    pending: 'warning',
    rejected: 'neutral',
    paid: 'success',
    failed: 'neutral',
  };

  const statusLabel: Record<PaymentStatus, string> = {
    pending: 'Chờ duyệt',
    rejected: 'Từ chối',
    paid: 'Đã thanh toán',
    failed: 'Thất bại',
  };

  // Nâng cấp giữa kỳ CẤN TRỪ thẳng vào hóa đơn mới ('applied'), không có khâu
  // admin duyệt tay -> chỉ có 2 trạng thái.
  const creditLabel: Record<CreditStatus, string> = {
    none: '—',
    applied: 'Đã cấn trừ',
  };

  const creditBadge: Record<CreditStatus, string> = {
    none: 'text-cafe-300',
    applied: 'badge-active',
  };

  const hasCredit = (p: Payment) => (p.creditStatus ?? 'none') !== 'none' && (p.creditAmount ?? 0) > 0;

  return (
    <div>
      <PageHeader title="Quản lý thanh toán" description={`${payments.length} giao dịch`} />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên hoặc mã giao dịch..." />
        <select
          className="input-funcafe !w-auto min-w-[150px]"
          value={packageFilter}
          onChange={e => setPackageFilter(e.target.value)}
          aria-label="Lọc theo gói dịch vụ"
        >
          <option value="all">Tất cả gói</option>
          {packageNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </FilterBar>

      <div className="bg-white rounded-2xl border border-line overflow-x-auto shadow-soft">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-sand border-b border-line">
            <tr>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Mã GD</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Người dùng</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Loại GD</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Gói</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Thời hạn</th>
              <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Số tiền</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Trạng thái</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Cấn trừ</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Thời gian</th>
              <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-sand/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-bold text-bean">{p.transactionCode}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{p.userName}</p>
                  <p className="text-xs text-cafe-400">{p.userEmail}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    p.actionType === 'new' ? 'bg-blue-100 text-blue-700' :
                    p.actionType === 'renew' ? 'bg-pine/12 text-pine' :
                    p.actionType === 'upgrade' ? 'bg-bean-tint text-bean' :
                    'bg-cafe-100 text-cafe-500'
                  }`}>
                    {p.actionType === 'new' ? 'Mới' : p.actionType === 'renew' ? 'Gia hạn' : p.actionType === 'upgrade' ? 'Nâng cấp' : p.actionType === 'cancel' ? 'Hủy gói' : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-cafe-600">{p.packageName}</td>
                <td className="px-4 py-3 text-cafe-500">{formatDuration(p.duration)}</td>
                <td className="px-4 py-3 text-right font-bold text-ink">{formatCurrency(p.amount)}</td>
                <td className="px-4 py-3"><StatusBadge tone={statusTone[p.status]}>{statusLabel[p.status]}</StatusBadge></td>
                <td className="px-4 py-3">
                  {hasCredit(p) ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-ink">{formatCurrency(p.creditAmount ?? 0)}</span>
                      <span className={`text-xs ${creditBadge[p.creditStatus ?? 'none']}`}>{creditLabel[p.creditStatus ?? 'none']}</span>
                    </div>
                  ) : (
                    <span className="text-cafe-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-cafe-400 text-xs">{formatDateTime(p.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setViewPayment(p)} title="Xem chi tiết" className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => setLockTarget(p)} className="p-2 text-gold-deep hover:bg-gold/15 rounded-lg transition-colors" title="Khóa/Mở khóa người dùng">
                      <Lock className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10}><EmptyState icon={CreditCard} title="Không có giao dịch nào" description="Chưa có giao dịch phù hợp với bộ lọc." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewPayment} onClose={() => setViewPayment(null)} title={`Giao dịch ${viewPayment?.transactionCode}`}>
        {viewPayment && (
          <div className="space-y-3 text-sm">
            {[
              { label: 'Mã giao dịch', value: viewPayment.transactionCode },
              { label: 'Người dùng', value: viewPayment.userName },
              { label: 'Email', value: viewPayment.userEmail },
              { label: 'Loại GD', value: viewPayment.actionType === 'new' ? 'Mới' : viewPayment.actionType === 'renew' ? 'Gia hạn' : viewPayment.actionType === 'upgrade' ? 'Nâng cấp' : viewPayment.actionType === 'cancel' ? 'Hủy gói' : '—' },
              { label: 'Gói đăng ký', value: viewPayment.packageName },
              { label: 'Thời hạn', value: formatDuration(viewPayment.duration) },
              { label: 'Số tiền', value: formatCurrency(viewPayment.amount) },
              { label: 'Trạng thái', value: statusLabel[viewPayment.status] },
              { label: 'Ngày tạo', value: formatDateTime(viewPayment.createdAt) },
              ...(viewPayment.confirmedAt ? [{ label: 'Ngày duyệt', value: formatDateTime(viewPayment.confirmedAt) }] : []),
              ...(hasCredit(viewPayment) ? [
                { label: 'Tiền cấn trừ', value: formatCurrency(viewPayment.creditAmount ?? 0) },
                { label: 'Trạng thái cấn trừ', value: creditLabel[viewPayment.creditStatus ?? 'none'] },
              ] : []),
              ...(viewPayment.note ? [{ label: 'Ghi chú', value: viewPayment.note }] : []),
            ].map(r => (
              <div key={r.label} className="flex gap-3 py-1.5 border-b border-line last:border-0">
                <span className="text-cafe-500 w-32 shrink-0">{r.label}:</span>
                <span className="text-ink font-medium">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!lockTarget}
        onClose={() => setLockTarget(null)}
        onConfirm={() => lockTarget && handleLockToggle(lockTarget)}
        title="Khóa/Mở khóa người dùng"
        message={`Thay đổi trạng thái của người dùng ${lockTarget?.userName} (${lockTarget?.userEmail})?`}
        confirmLabel="Xác nhận"
        danger
        loading={processing}
      />
    </div>
  );
}
