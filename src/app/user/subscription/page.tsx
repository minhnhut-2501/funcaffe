'use client';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { packageService, subscriptionService, timeSubscriptionService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, formatDuration, formatDateTime, formatPaymentMethod } from '@/lib/format';
import { Check, CreditCard, AlertCircle, ArrowUp, RotateCcw, History } from 'lucide-react';
import type { Package, DurationMonths, TimeSubscription, MyPayment } from '@/types';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';

const durations: { value: DurationMonths; label: string }[] = [
  { value: 1, label: '1 tháng' },
  { value: 3, label: '3 tháng' },
  { value: 12, label: '12 tháng' },
];

function getPrice(timeSubs: TimeSubscription[], dur: DurationMonths) {
  const found = timeSubs.find(t => t.durationValue === dur && t.durationUnit === 'month');
  return found?.price ?? 0;
}

function getTimeSubId(timeSubs: TimeSubscription[], dur: DurationMonths): string | undefined {
  const found = timeSubs.find(t => t.durationValue === dur && t.durationUnit === 'month');
  return found?.id;
}

type FlowAction = 'new' | 'renew' | 'upgrade' | null;

export default function SubscriptionPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const pkg = user?.subscription.packageType ?? 'none';
  const sub = user?.subscription;
  const [packages, setPackages] = useState<Package[]>([]);
  const [timeSubsMap, setTimeSubsMap] = useState<Record<string, TimeSubscription[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [payments, setPayments] = useState<MyPayment[]>([]);

  const loadPayments = () => subscriptionService.payments().then(setPayments).catch(() => {});

  const currentLevel = useMemo(() => {
    if (pkg === 'none' || !packages.length) return -1;
    const current = packages.find(p => p.type === pkg);
    return current?.level ?? -1;
  }, [pkg, packages]);

  const maxLevel = useMemo(() => {
    if (!packages.length) return -1;
    return Math.max(...packages.map(p => p.level));
  }, [packages]);

  const upgradePackages = useMemo(() => {
    if (currentLevel < 0) return [];
    return packages.filter(p => p.level > currentLevel && p.isActive);
  }, [packages, currentLevel]);

  const canUpgrade = upgradePackages.length > 0;
  const isMaxLevel = currentLevel >= maxLevel && currentLevel >= 0;

  useEffect(() => {
    (async () => {
      try {
        const pkgs = await packageService.list();
        setPackages(pkgs);
        const map: Record<string, TimeSubscription[]> = {};
        for (const p of pkgs) {
          try { map[p.id] = await timeSubscriptionService.listByPackage(p.id); } catch { map[p.id] = []; }
        }
        setTimeSubsMap(map);
      } catch { setError(true); }
      finally { setLoading(false); }
    })();
    loadPayments();
  }, []);

  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [selectedDur, setSelectedDur] = useState<DurationMonths>(1);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('vnpay');
  const [submitting, setSubmitting] = useState(false);
  const [flowAction, setFlowAction] = useState<FlowAction>(null);

  const selected = (packages ?? []).find(p => p.id === selectedPkg);

  const resetSelection = () => {
    setSelectedPkg(null);
    setSelectedDur(1);
    setFlowAction(null);
  };

  const openPayment = (action: FlowAction, pkgId?: string) => {
    setFlowAction(action);
    if (pkgId) setSelectedPkg(pkgId);
    else if (action === 'renew') {
      const curPkg = packages.find(p => p.type === pkg);
      if (curPkg) setSelectedPkg(curPkg.id);
    }
    setPaymentModal(true);
  };

  const handleSubmit = async () => {
    if (!selectedPkg) return;
    const tsId = getTimeSubId(timeSubsMap[selectedPkg] ?? [], selectedDur);
    setSubmitting(true);
    try {
      const res: any = await subscriptionService.create({
        package_id: selectedPkg,
        time_subscription_id: tsId,
        payment_method: paymentMethod,
      });
      // VNPay: backend trả payment_url -> chuyển hướng sang cổng thanh toán
      if (res?.payment_url) {
        window.location.href = res.payment_url;
        return;
      }
      if (refreshUser) await refreshUser();
      loadPayments();
      toast({ description: flowAction === 'upgrade' ? 'Nâng cấp gói thành công!' : flowAction === 'renew' ? 'Gia hạn thành công!' : 'Đăng ký gói thành công!' });
      setPaymentModal(false);
      resetSelection();
    } catch (err: any) {
      toast({ description: err?.message || err?.errors?.message || 'Thao tác thất bại, vui lòng thử lại', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const pageTitle = flowAction === 'upgrade' ? 'Nâng cấp gói' : flowAction === 'renew' ? 'Gia hạn gói' : 'Thanh toán gói dịch vụ';
  const confirmLabel = flowAction === 'upgrade' ? 'Xác nhận nâng cấp' : flowAction === 'renew' ? 'Xác nhận gia hạn' : 'Xác nhận đã thanh toán';

  return (
    <div>
      <PageHeader title="Gói dịch vụ" description="Quản lý gói dịch vụ của bạn" />

      {/* Current Plan Card */}
      <div className="card-funcafe mb-6">
        <h2 className="text-base font-bold text-ink mb-3">Gói hiện tại</h2>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xl font-bold text-bean">{sub?.packageName}</p>
            {sub?.packageType !== 'none' && (
              <div className="text-sm text-cafe-500 mt-1 space-x-4">
                <span>Bắt đầu: {sub ? formatDate(sub.startDate) : ''}</span>
                <span>Hết hạn: {sub ? formatDate(sub.endDate) : ''}</span>
                <span className="font-semibold text-bean">Còn {sub?.daysLeft} ngày</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sub?.packageType === 'none' && <span className="badge-inactive">Chưa có gói</span>}
            {sub?.isPendingReview && (
              <span className="badge-pending">Đang chờ admin kiểm tra</span>
            )}
            {sub?.packageType !== 'none' && !sub?.isPendingReview && (
              <span className="badge-active">Đang hoạt động</span>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade / Renew actions */}
      {pkg !== 'none' && !loading && (
        <div className="flex flex-wrap gap-3 mb-6">
          {canUpgrade && (
            <button
              onClick={() => {
                setFlowAction('upgrade');
                setSelectedPkg(null);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <ArrowUp className="w-4 h-4" /> Nâng cấp gói
            </button>
          )}
          {isMaxLevel && (
            <button
              onClick={() => openPayment('renew')}
              className="btn-secondary flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Gia hạn gói
            </button>
          )}
        </div>
      )}

      {/* Pending review warning */}
      {sub?.isPendingReview && (
        <div className="mb-4 flex items-center gap-3 bg-gold/12 border border-gold/25 rounded-2xl p-4 text-gold-deep">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Thanh toán đang chờ admin kiểm tra</p>
            <p className="text-xs mt-0.5 opacity-80">Bạn vẫn có thể sử dụng gói trong thời gian chờ duyệt.</p>
          </div>
        </div>
      )}

      {/* #4: Thông báo hoàn tiền khi nâng cấp */}
      {sub?.refundStatus === 'pending' && (sub?.refundAmount ?? 0) > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800">
          <CreditCard className="w-5 h-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-semibold text-sm">Hoàn tiền {formatCurrency(sub!.refundAmount!)} cho phần thời gian còn lại của gói cũ</p>
            <p className="text-xs text-blue-700 mt-0.5">Khoản hoàn tiền đang chờ admin xem và xác nhận.</p>
          </div>
        </div>
      )}
      {sub?.refundStatus === 'approved' && (sub?.refundAmount ?? 0) > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-pine/10 border border-pine/25 rounded-2xl p-4 text-pine">
          <Check className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Đã hoàn {formatCurrency(sub!.refundAmount!)} cho phần thời gian còn lại của gói cũ</p>
            <p className="text-xs mt-0.5 opacity-80">Admin đã xác nhận khoản hoàn tiền của bạn.</p>
          </div>
        </div>
      )}

      {/* Lịch sử thanh toán gói của user */}
      <div className="card-funcafe mb-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-bean" />
          <h2 className="text-base font-bold text-ink">Lịch sử thanh toán</h2>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-cafe-400 text-center py-6">Chưa có giao dịch thanh toán nào.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-sand border-b border-line">
                <tr>
                  <th className="text-left px-3 py-2.5 text-cafe-600 font-semibold">Mã GD</th>
                  <th className="text-left px-3 py-2.5 text-cafe-600 font-semibold">Gói</th>
                  <th className="text-left px-3 py-2.5 text-cafe-600 font-semibold">Loại</th>
                  <th className="text-right px-3 py-2.5 text-cafe-600 font-semibold">Số tiền</th>
                  <th className="text-left px-3 py-2.5 text-cafe-600 font-semibold">Phương thức</th>
                  <th className="text-left px-3 py-2.5 text-cafe-600 font-semibold">Trạng thái</th>
                  <th className="text-left px-3 py-2.5 text-cafe-600 font-semibold">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-sand/50 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-xs font-bold text-bean">{p.transactionCode || '—'}</td>
                    <td className="px-3 py-2.5 text-ink">{p.packageName || '—'}</td>
                    <td className="px-3 py-2.5 text-cafe-600">
                      {p.actionType === 'new' ? 'Đăng ký mới' : p.actionType === 'renew' ? 'Gia hạn' : p.actionType === 'upgrade' ? 'Nâng cấp' : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-cafe-800">
                      {formatCurrency(p.amount)}
                      {p.refundStatus && p.refundStatus !== 'none' && (p.refundAmount ?? 0) > 0 && (
                        <span className="block text-[11px] text-cafe-400 font-normal">
                          Hoàn {formatCurrency(p.refundAmount!)} · {p.refundStatus === 'pending' ? 'chờ duyệt' : p.refundStatus === 'approved' ? 'đã hoàn' : 'từ chối'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-cafe-600">{formatPaymentMethod(p.paymentMethod)}</td>
                    <td className="px-3 py-2">
                      <span className={p.status === 'paid' ? 'badge-active' : p.status === 'pending' ? 'badge-pending' : 'badge-inactive'}>
                        {p.status === 'paid' ? 'Đã thanh toán' : p.status === 'pending' ? 'Chờ duyệt' : p.status === 'rejected' ? 'Bị từ chối' : 'Thất bại'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-cafe-400 text-xs">{formatDateTime(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 className="text-lg font-bold text-ink mb-4">
        {flowAction === 'upgrade' ? 'Chọn gói nâng cấp' :
         flowAction === 'renew' ? 'Gia hạn gói hiện tại' :
         'Chọn gói dịch vụ'}
      </h2>

      {loading && <LoadingSkeleton variant="card" rows={3} />}
      {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải danh sách gói dịch vụ.</span></div>}
      {!loading && !error && (packages ?? []).length === 0 && <EmptyState title="Chưa có gói dịch vụ" description="Hiện chưa có gói nào khả dụng." />}

      {/* Plan selection grid */}
      {!loading && !error && packages.length > 0 && (
        <>
          {/* Duration tabs — chỉ hiển thị khi gói được chọn không phải trial */}
          {(flowAction === 'new' || flowAction === 'renew') && (
            (() => {
              const selectedPkgObj = packages.find(p => p.id === selectedPkg);
              const showDuration = !selectedPkg || !selectedPkgObj?.isTrial;
              return showDuration ? (
                <div className="segmented mb-4">
                  {durations.map(d => (
                    <button key={d.value} onClick={() => setSelectedDur(d.value)}
                      className={`seg-item ${selectedDur === d.value ? 'seg-item-active' : ''}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              ) : null;
            })()
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {(flowAction === 'upgrade' ? upgradePackages : packages).map(p => {
              const price = getPrice(timeSubsMap[p.id] ?? [], selectedDur);
              const isSelected = selectedPkg === p.id;
              return (
                <div key={p.id} onClick={() => setSelectedPkg(p.id)}
                  className={`rounded-2xl border p-5 cursor-pointer transition-all ${isSelected ? 'border-bean ring-2 ring-bean/40 bg-bean-tint shadow-card' : 'border-line hover:border-cafe-300 bg-white shadow-soft hover:-translate-y-0.5'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-ink">{p.name}</h3>
                    {isSelected && <div className="w-5 h-5 bg-bean rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                  </div>
                  <p className="text-2xl font-bold text-bean mb-1">{p.isTrial ? 'Miễn phí' : formatCurrency(price)}</p>
                  {!p.isTrial && flowAction !== 'upgrade' && <p className="text-xs text-cafe-400 mb-2">/{formatDuration(selectedDur)}</p>}
                  <p className="text-xs text-cafe-500 mb-3">{p.description}</p>
                  <ul className="space-y-1.5">
                    {p.features.slice(0, 4).map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-cafe-600">
                        <Check className="w-3.5 h-3.5 text-pine shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {flowAction === 'upgrade' && upgradePackages.length === 0 && (
              <div className="col-span-3 text-center text-cafe-400 py-8">Không có gói cao hơn để nâng cấp.</div>
            )}
          </div>

          {/* Action button */}
          {selectedPkg && (
            <div className="rounded-2xl border border-bean/30 bg-bean-tint/50 p-5 sm:p-6 mb-4">
              <h3 className="font-bold text-ink mb-3">
                {flowAction === 'upgrade' ? 'Nâng cấp lên' : flowAction === 'renew' ? 'Gia hạn' : 'Tóm tắt thanh toán'}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-ink">
                  <span>Gói {selected?.name}</span>
                  <span>{selected?.isTrial ? 'Miễn phí' : formatCurrency(getPrice(timeSubsMap[selected!.id] ?? [], selectedDur))}</span>
                </div>
                {!selected?.isTrial && (
                  <div className="flex justify-between text-cafe-500"><span>Thời hạn</span><span>{formatDuration(selectedDur)}</span></div>
                )}
                <div className="border-t border-line pt-2 flex justify-between font-bold text-ink">
                  <span>Tổng cộng</span>
                  <span className="text-bean">{selected?.isTrial ? 'Miễn phí' : formatCurrency(getPrice(timeSubsMap[selected!.id] ?? [], selectedDur))}</span>
                </div>
              </div>
              <div className="mt-4">
                <button onClick={() => openPayment(flowAction)} className="btn-primary w-full flex items-center justify-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  {flowAction === 'upgrade' ? 'Nâng cấp ngay' : flowAction === 'renew' ? 'Gia hạn ngay' : selected?.isTrial ? 'Kích hoạt Fun Free' : 'Thanh toán ngay'}
                </button>
              </div>
            </div>
          )}

          {/* "New subscription" flow: show for users with no plan */}
          {pkg === 'none' && !selectedPkg && (
            <p className="text-center text-cafe-400 text-sm mt-2">Vui lòng chọn một gói để tiếp tục.</p>
          )}
        </>
      )}

      <Modal open={paymentModal} onClose={() => { setPaymentModal(false); resetSelection(); }} title={pageTitle}>
        <div className="space-y-4">
          <p className="text-sm text-cafe-600">
            {flowAction === 'upgrade' ? 'Xác nhận nâng cấp lên' : flowAction === 'renew' ? 'Xác nhận gia hạn' : 'Chọn phương thức thanh toán'} gói <strong>{selected?.name}</strong>
          </p>
          {/* BUG-03 FIX: Dùng đúng giá trị payment_method theo spec */}
          {!selected?.isTrial && (
            <div className="space-y-2">
              {[
                { value: 'vnpay', label: 'Thanh toán online qua VNPay (kích hoạt tự động)' },
                { value: 'bank_transfer', label: 'Chuyển khoản ngân hàng' },
                { value: 'qr_code', label: 'QR Code' },
                { value: 'e_wallet', label: 'Ví điện tử (Momo, ZaloPay...)' },
              ].map(m => (
                <label key={m.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${paymentMethod === m.value ? 'border-bean bg-bean-tint' : 'border-line hover:bg-sand'}`}>
                  <input type="radio" name="payMethod" value={m.value} checked={paymentMethod === m.value} onChange={() => setPaymentMethod(m.value)} className="accent-bean" />
                  <span className="text-sm text-ink">{m.label}</span>
                </label>
              ))}
            </div>
          )}
          {paymentMethod === 'bank_transfer' && !selected?.isTrial && (
            <div className="bg-sand rounded-xl p-3.5 text-sm space-y-1 text-ink/80 border border-line">
              <p><strong>Ngân hàng:</strong> Vietcombank</p>
              <p><strong>Số tài khoản:</strong> 1234 5678 9012</p>
              <p><strong>Chủ tài khoản:</strong> FUNCAFE VN</p>
              <p><strong>Nội dung:</strong> FUNCAFE {user?.id?.toUpperCase()} {selected?.name?.toUpperCase()}</p>
            </div>
          )}
          {paymentMethod === 'qr_code' && !selected?.isTrial && (
            <div className="bg-sand rounded-xl p-6 flex flex-col items-center gap-2 border border-line">
              <div className="w-32 h-32 bg-white border-2 border-line rounded-xl flex items-center justify-center text-cafe-300 text-xs">QR Code</div>
              <p className="text-xs text-cafe-500">Quét mã để thanh toán</p>
            </div>
          )}
          {paymentMethod === 'vnpay' && !selected?.isTrial && (
            <div className="bg-sand rounded-xl p-3.5 text-sm text-ink/80 border border-line">
              Bạn sẽ được chuyển sang cổng VNPay để thanh toán. Sau khi thanh toán thành công, gói sẽ được <strong>kích hoạt tự động</strong> mà không cần admin duyệt.
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setPaymentModal(false); resetSelection(); }} className="btn-secondary flex-1" disabled={submitting}>Hủy</button>
            <button onClick={handleSubmit} className="btn-primary flex-1" disabled={submitting}>
              {submitting ? 'Đang xử lý...' : (paymentMethod === 'vnpay' && !selected?.isTrial ? 'Thanh toán qua VNPay' : confirmLabel)}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
