'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { paymentService, userService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDateTime, formatDuration } from '@/lib/format';
import type { Payment, PaymentStatus, RefundStatus } from '@/types';
import { Eye, Check, X, RotateCcw, Pencil, Lock, Banknote, Ban, CreditCard } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge, { type Tone } from '@/components/user/StatusBadge';

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [viewPayment, setViewPayment] = useState<Payment | null>(null);
  const [approveTarget, setApproveTarget] = useState<Payment | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Payment | null>(null);
  const [resetTarget, setResetTarget] = useState<Payment | null>(null);
  const [editTarget, setEditTarget] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, note: '' });
  const [lockTarget, setLockTarget] = useState<Payment | null>(null);
  const [refundApproveTarget, setRefundApproveTarget] = useState<Payment | null>(null);
  const [refundRejectTarget, setRefundRejectTarget] = useState<Payment | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = () => paymentService.list().then(setPayments).catch(() => toast({ description: 'Không thể tải danh sách thanh toán', variant: 'destructive' }));
  useEffect(() => { load(); }, []);

  const filtered = payments.filter(p =>
    (statusFilter === 'all' || p.status === statusFilter) &&
    (p.userName.toLowerCase().includes(search.toLowerCase()) || p.transactionCode.toLowerCase().includes(search.toLowerCase()))
  );

  const handleApprove = async (id: string) => {
    setProcessing(true);
    try {
      await paymentService.approve(id);
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'paid', confirmedAt: new Date().toISOString() } : p));
      setApproveTarget(null);
      toast({ description: 'Đã duyệt giao dịch' });
    } catch {
      toast({ description: 'Duyệt thất bại', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(true);
    try {
      await paymentService.reject(id);
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
      setRejectTarget(null);
      toast({ description: 'Đã từ chối giao dịch' });
    } catch {
      toast({ description: 'Từ chối thất bại', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = async (id: string) => {
    setProcessing(true);
    try {
      await paymentService.reset(id);
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'pending', confirmedAt: undefined } : p));
      setResetTarget(null);
      toast({ description: 'Đã đưa giao dịch về trạng thái chờ duyệt' });
    } catch {
      toast({ description: 'Reset thất bại', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

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

  const handleApproveRefund = async (id: string) => {
    setProcessing(true);
    try {
      const updated = await paymentService.approveRefund(id);
      setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
      setRefundApproveTarget(null);
      toast({ description: 'Đã xác nhận hoàn tiền' });
    } catch {
      toast({ description: 'Xác nhận hoàn tiền thất bại', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectRefund = async (id: string) => {
    setProcessing(true);
    try {
      const updated = await paymentService.rejectRefund(id);
      setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
      setRefundRejectTarget(null);
      toast({ description: 'Đã từ chối hoàn tiền' });
    } catch {
      toast({ description: 'Từ chối hoàn tiền thất bại', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const openEdit = (p: Payment) => {
    setEditTarget(p);
    setEditForm({ amount: p.amount, note: p.note ?? '' });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setProcessing(true);
    try {
      const updated = await paymentService.update(editTarget.id, editForm);
      setPayments(prev => prev.map(p => p.id === editTarget.id ? { ...p, ...updated } : p));
      setEditTarget(null);
      toast({ description: 'Đã cập nhật giao dịch' });
    } catch {
      toast({ description: 'Cập nhật thất bại', variant: 'destructive' });
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

  const refundLabel: Record<RefundStatus, string> = {
    none: '—',
    pending: 'Chờ hoàn tiền',
    approved: 'Đã hoàn tiền',
    rejected: 'Từ chối hoàn',
  };

  const refundBadge: Record<RefundStatus, string> = {
    none: 'text-cafe-300',
    pending: 'badge-pending',
    approved: 'badge-active',
    rejected: 'badge-inactive',
  };

  const hasRefund = (p: Payment) => (p.refundStatus ?? 'none') !== 'none' && (p.refundAmount ?? 0) > 0;

  return (
    <div>
      <PageHeader title="Quản lý thanh toán" description={`${payments.length} giao dịch`} />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên hoặc mã giao dịch..." />
        <select className="input-funcafe !w-auto min-w-[150px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value as PaymentStatus | 'all')}>
          <option value="all">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="paid">Đã thanh toán</option>
          <option value="rejected">Từ chối</option>
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
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Hoàn tiền</th>
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
                    {p.actionType === 'new' ? 'Mới' : p.actionType === 'renew' ? 'Gia hạn' : p.actionType === 'upgrade' ? 'Nâng cấp' : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-cafe-600">{p.packageName}</td>
                <td className="px-4 py-3 text-cafe-500">{formatDuration(p.duration)}</td>
                <td className="px-4 py-3 text-right font-bold text-ink">{formatCurrency(p.amount)}</td>
                <td className="px-4 py-3"><StatusBadge tone={statusTone[p.status]}>{statusLabel[p.status]}</StatusBadge></td>
                <td className="px-4 py-3">
                  {hasRefund(p) ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-ink">{formatCurrency(p.refundAmount ?? 0)}</span>
                      <span className={`text-xs ${refundBadge[p.refundStatus ?? 'none']}`}>{refundLabel[p.refundStatus ?? 'none']}</span>
                    </div>
                  ) : (
                    <span className="text-cafe-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-cafe-400 text-xs">{formatDateTime(p.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setViewPayment(p)} className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(p)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setLockTarget(p)} className="p-2 text-gold-deep hover:bg-gold/15 rounded-lg transition-colors" title="Khóa/Mở khóa người dùng">
                      <Lock className="w-4 h-4" />
                    </button>
                    {p.status === 'pending' && (
                      <>
                        <button onClick={() => setApproveTarget(p)} className="p-2 text-pine hover:bg-pine/12 rounded-lg transition-colors"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setRejectTarget(p)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                      </>
                    )}
                    {p.status !== 'pending' && (
                      <button onClick={() => setResetTarget(p)} className="p-2 text-gold-deep hover:bg-gold/15 rounded-lg transition-colors" title="Đưa về chờ duyệt">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {p.refundStatus === 'pending' && (
                      <>
                        <button onClick={() => setRefundApproveTarget(p)} className="p-2 text-pine hover:bg-pine/12 rounded-lg transition-colors" title="Xác nhận hoàn tiền">
                          <Banknote className="w-4 h-4" />
                        </button>
                        <button onClick={() => setRefundRejectTarget(p)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Từ chối hoàn tiền">
                          <Ban className="w-4 h-4" />
                        </button>
                      </>
                    )}
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
              { label: 'Loại GD', value: viewPayment.actionType === 'new' ? 'Mới' : viewPayment.actionType === 'renew' ? 'Gia hạn' : viewPayment.actionType === 'upgrade' ? 'Nâng cấp' : '—' },
              { label: 'Gói đăng ký', value: viewPayment.packageName },
              { label: 'Thời hạn', value: formatDuration(viewPayment.duration) },
              { label: 'Số tiền', value: formatCurrency(viewPayment.amount) },
              { label: 'Trạng thái', value: statusLabel[viewPayment.status] },
              { label: 'Ngày tạo', value: formatDateTime(viewPayment.createdAt) },
              ...(viewPayment.confirmedAt ? [{ label: 'Ngày duyệt', value: formatDateTime(viewPayment.confirmedAt) }] : []),
              ...(hasRefund(viewPayment) ? [
                { label: 'Tiền hoàn lại', value: formatCurrency(viewPayment.refundAmount ?? 0) },
                { label: 'Trạng thái hoàn', value: refundLabel[viewPayment.refundStatus ?? 'none'] },
                ...(viewPayment.refundedAt ? [{ label: 'Ngày hoàn tiền', value: formatDateTime(viewPayment.refundedAt) }] : []),
                ...(viewPayment.refundNote ? [{ label: 'Ghi chú hoàn tiền', value: viewPayment.refundNote }] : []),
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

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Chỉnh sửa giao dịch ${editTarget?.transactionCode}`} size="md">
        {editTarget && (
          <div className="space-y-4">
            <div>
              <label className="label-funcafe">Số tiền (đ)</label>
              <input type="number" min={0} className="input-funcafe" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label-funcafe">Ghi chú</label>
              <textarea rows={3} className="input-funcafe resize-none" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditTarget(null)} className="btn-secondary flex-1">Hủy</button>
              <button onClick={handleEdit} className="btn-primary flex-1" disabled={processing}>Lưu thay đổi</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => approveTarget && handleApprove(approveTarget.id)}
        title="Duyệt giao dịch"
        message={`Xác nhận duyệt giao dịch ${approveTarget?.transactionCode} của ${approveTarget?.userName}?`}
        confirmLabel="Duyệt"
        loading={processing}
      />

      <ConfirmModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && handleReject(rejectTarget.id)}
        title="Từ chối giao dịch"
        message={`Từ chối giao dịch ${rejectTarget?.transactionCode} của ${rejectTarget?.userName}?`}
        confirmLabel="Từ chối"
        danger
        loading={processing}
      />

      <ConfirmModal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={() => resetTarget && handleReset(resetTarget.id)}
        title="Reset giao dịch"
        message={`Đưa giao dịch ${resetTarget?.transactionCode} của ${resetTarget?.userName} về trạng thái chờ duyệt?`}
        confirmLabel="Reset"
        loading={processing}
      />

      <ConfirmModal
        open={!!refundApproveTarget}
        onClose={() => setRefundApproveTarget(null)}
        onConfirm={() => refundApproveTarget && handleApproveRefund(refundApproveTarget.id)}
        title="Xác nhận hoàn tiền"
        message={`Xác nhận đã hoàn ${formatCurrency(refundApproveTarget?.refundAmount ?? 0)} cho ${refundApproveTarget?.userName} (nâng cấp gói ${refundApproveTarget?.packageName})?`}
        confirmLabel="Xác nhận hoàn tiền"
        loading={processing}
      />

      <ConfirmModal
        open={!!refundRejectTarget}
        onClose={() => setRefundRejectTarget(null)}
        onConfirm={() => refundRejectTarget && handleRejectRefund(refundRejectTarget.id)}
        title="Từ chối hoàn tiền"
        message={`Từ chối khoản hoàn ${formatCurrency(refundRejectTarget?.refundAmount ?? 0)} của ${refundRejectTarget?.userName}?`}
        confirmLabel="Từ chối hoàn tiền"
        danger
        loading={processing}
      />

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
