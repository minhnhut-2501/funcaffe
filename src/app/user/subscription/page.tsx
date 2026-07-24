'use client';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import { VnpayLogo } from '@/components/ui/PaymentLogos';
import { useAuth } from '@/context/AuthContext';
import { packageService, subscriptionService, timeSubscriptionService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, formatDuration, formatDateTime, formatPaymentMethod } from '@/lib/format';
import { Check, CreditCard, AlertCircle, ArrowUp, RotateCcw, History, Store } from 'lucide-react';
import type { Package, DurationMonths, TimeSubscription, MyPayment } from '@/types';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { isSubscriptionExpired } from '@/lib/permission';

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
type Tab = 'plans' | 'history';

export default function SubscriptionPage() {
  const { user, refreshUser, cafes, activeCafeId } = useAuth();
  const { toast } = useToast();
  const pkg = user?.subscription.packageType ?? 'none';
  const sub = user?.subscription;
  const activeCafeName = cafes.find(c => c.id === activeCafeId)?.name ?? null;
  const [tab, setTab] = useState<Tab>('plans');
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
    // Nạp lại lịch sử thanh toán khi đổi quán đang chọn (gói theo từng quán).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCafeId]);

  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [selectedDur, setSelectedDur] = useState<DurationMonths>(1);
  const [paymentModal, setPaymentModal] = useState(false);
  // Subscription chỉ hỗ trợ VNPay (cổng thật, kích hoạt tự động).
  const paymentMethod = 'vnpay';
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(''); // lỗi hiển thị NGAY TRONG modal (không chỉ toast)
  const [flowAction, setFlowAction] = useState<FlowAction>(null);

  const selected = (packages ?? []).find(p => p.id === selectedPkg);

  // Hành động tương ứng khi chọn 1 gói, dựa trên gói đang dùng (khớp logic backend):
  // chưa có gói -> mua mới; cao hơn -> nâng cấp; bằng -> gia hạn; thấp hơn -> KHÔNG cho (hạ gói).
  const actionFor = (p: Package): 'new' | 'upgrade' | 'renew' | 'downgrade' => {
    if (currentLevel < 0) return 'new';
    if (p.level > currentLevel) return 'upgrade';
    if (p.level === currentLevel) return 'renew';
    return 'downgrade';
  };

  // Mở popup mua/nâng cấp/gia hạn cho một gói cụ thể.
  const openPackageModal = (p: Package) => {
    const action = actionFor(p);
    if (action === 'downgrade') {
      toast({
        description: `Bạn đang dùng gói cao hơn — không thể chuyển xuống "${p.name}" khi gói hiện tại còn hiệu lực. Vui lòng chờ gói hết hạn nếu muốn đổi sang gói thấp hơn.`,
        variant: 'destructive',
      });
      return;
    }
    setFlowAction(action === 'new' ? null : action);
    setSelectedPkg(p.id);
    setSubmitError('');
    setPaymentModal(true);
  };

  const resetSelection = () => {
    setSelectedPkg(null);
    setSelectedDur(1);
    setFlowAction(null);
    setSubmitError('');
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
    setSubmitError('');
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
      const msg = err?.message || err?.errors?.message || 'Thao tác thất bại, vui lòng thử lại';
      setSubmitError(msg); // hiện lỗi NGAY TRONG modal — toast có thể bị bỏ lỡ
      toast({ description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const pageTitle = flowAction === 'upgrade' ? 'Nâng cấp gói' : flowAction === 'renew' ? 'Gia hạn gói' : 'Thanh toán gói dịch vụ';
  const hasCreditNote = (sub?.creditAmount ?? 0) > 0 && sub?.creditStatus === 'applied';

  return (
    <div className="max-w-5xl">
      <PageHeader title="Gói dịch vụ" description="Mỗi quán có gói riêng — bạn đang thao tác cho quán đang chọn" />

      {/* Thẻ gói hiện tại — gộp tên quán + trạng thái + hành động + hoàn tiền vào một chỗ */}
      <div className="card-funcafe mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h2 className="text-base font-bold text-ink">Gói hiện tại</h2>
              {activeCafeName && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-bean bg-bean-tint px-2 py-0.5 rounded-full">
                  <Store className="w-3 h-3" />{activeCafeName}
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-bean">{sub?.packageName}</p>
            {sub?.packageType !== 'none' && (
              <div className="text-sm text-cafe-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>Bắt đầu: {sub ? formatDate(sub.startDate) : ''}</span>
                <span>Hết hạn: {sub ? formatDate(sub.endDate) : ''}</span>
                <span className={`font-semibold ${isSubscriptionExpired(sub) ? 'text-red-600' : 'text-bean'}`}>
                  {isSubscriptionExpired(sub) ? 'Đã hết hạn' : `Còn ${sub?.daysLeft} ngày`}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0 ml-auto">
            {sub?.packageType === 'none'
              ? <span className="badge-inactive">Chưa có gói</span>
              : isSubscriptionExpired(sub)
                ? <span className="badge-inactive">Đã hết hạn</span>
                : <span className="badge-active">Đang hoạt động</span>}

            {pkg !== 'none' && !loading && (
              <div className="flex flex-wrap justify-end gap-2">
                {canUpgrade && (
                  <button
                    onClick={() => { setTab('plans'); setFlowAction('upgrade'); setSelectedPkg(null); }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <ArrowUp className="w-4 h-4" /> Nâng cấp gói
                  </button>
                )}
                {isMaxLevel && (
                  <button onClick={() => openPayment('renew')} className="btn-secondary flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" /> Gia hạn gói
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cấn trừ khi nâng cấp — gộp gọn vào thẻ, không còn banner riêng */}
        {hasCreditNote && (
          <div className="mt-4 pt-4 border-t border-line flex items-start gap-2 text-sm">
            <CreditCard className="w-4 h-4 shrink-0 mt-0.5 text-bean" />
            <p className="text-cafe-600">
              Đã cấn trừ <b className="text-ink">{formatCurrency(sub!.creditAmount!)}</b> phần còn lại của gói cũ vào giá nâng cấp — bạn chỉ trả phần chênh lệch.
            </p>
          </div>
        )}
      </div>

      {/* Tabs: tách "chọn gói" và "lịch sử thanh toán" để trang không bị nhồi */}
      <div className="flex gap-1 border-b border-line mb-6">
        <button onClick={() => setTab('plans')}
          className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${tab === 'plans' ? 'border-bean text-bean font-semibold' : 'border-transparent text-cafe-500 hover:text-ink font-medium'}`}>
          Gói dịch vụ
        </button>
        <button onClick={() => setTab('history')}
          className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 ${tab === 'history' ? 'border-bean text-bean font-semibold' : 'border-transparent text-cafe-500 hover:text-ink font-medium'}`}>
          <History className="w-4 h-4" />Lịch sử thanh toán
          {payments.length > 0 && <span className="text-[11px] font-semibold bg-sand text-cafe-500 rounded-full px-1.5">{payments.length}</span>}
        </button>
      </div>

      {/* ===== Tab: Gói dịch vụ ===== */}
      {tab === 'plans' && (
        <>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-ink">
              {flowAction === 'upgrade' ? 'Chọn gói nâng cấp' : flowAction === 'renew' ? 'Gia hạn gói hiện tại' : 'Chọn gói dịch vụ'}
            </h2>
            {flowAction === 'upgrade' && (
              <button onClick={() => { setFlowAction(null); }} className="text-sm text-cafe-500 hover:text-bean font-medium">Xem tất cả gói</button>
            )}
          </div>

          {loading && <LoadingSkeleton variant="card" rows={3} />}
          {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải danh sách gói dịch vụ.</span></div>}
          {!loading && !error && (packages ?? []).length === 0 && <EmptyState title="Chưa có gói dịch vụ" description="Hiện chưa có gói nào khả dụng." />}

          {!loading && !error && packages.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(flowAction === 'upgrade' ? upgradePackages : packages).map(p => {
                const price = getPrice(timeSubsMap[p.id] ?? [], 1);
                const action = actionFor(p);
                const isCurrent = action === 'renew';
                const isBlocked = action === 'downgrade';
                return (
                  <div key={p.id} onClick={() => openPackageModal(p)}
                    className={`relative rounded-2xl border bg-white shadow-soft p-5 transition-all flex flex-col ${
                      isBlocked
                        ? 'border-line opacity-60 cursor-not-allowed'
                        : 'border-line hover:border-bean hover:-translate-y-0.5 hover:shadow-card cursor-pointer'
                    } ${isCurrent ? 'border-bean ring-1 ring-bean/30' : ''}`}>
                    {isCurrent && (
                      <span className="absolute -top-2.5 left-4 text-[11px] font-bold bg-bean text-white px-2.5 py-0.5 rounded-full">Gói hiện tại</span>
                    )}
                    <h3 className="text-lg font-bold text-ink mb-2">{p.name}</h3>
                    <p className="text-2xl font-bold text-bean mb-1">{p.isTrial ? 'Miễn phí' : formatCurrency(price)}</p>
                    {!p.isTrial && <p className="text-xs text-cafe-400 mb-2">/tháng</p>}
                    <p className="text-xs text-cafe-500 mb-3">{p.description}</p>
                    <ul className="space-y-1.5 mb-4 flex-1">
                      {p.features.slice(0, 4).map(f => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-cafe-600">
                          <Check className="w-3.5 h-3.5 text-pine shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                    {isBlocked ? (
                      <span className="w-full flex items-center justify-center gap-2 rounded-xl bg-sand text-cafe-400 text-sm font-semibold py-2.5 pointer-events-none">
                        Thấp hơn gói hiện tại
                      </span>
                    ) : (
                      <span className="btn-primary w-full flex items-center justify-center gap-2 pointer-events-none">
                        {action === 'renew' ? <RotateCcw className="w-4 h-4" /> : action === 'upgrade' ? <ArrowUp className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                        {p.isTrial ? 'Kích hoạt Fun Free' : action === 'renew' ? 'Gia hạn gói này' : action === 'upgrade' ? 'Nâng cấp lên gói này' : 'Chọn gói này'}
                      </span>
                    )}
                  </div>
                );
              })}
              {flowAction === 'upgrade' && upgradePackages.length === 0 && (
                <div className="col-span-3 text-center text-cafe-400 py-8">Không có gói cao hơn để nâng cấp.</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== Tab: Lịch sử thanh toán ===== */}
      {tab === 'history' && (
        <div className="card-funcafe">
          {payments.length === 0 ? (
            <p className="text-sm text-cafe-400 text-center py-10">Chưa có giao dịch thanh toán nào.</p>
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
                        {p.actionType === 'new' ? 'Đăng ký mới' : p.actionType === 'renew' ? 'Gia hạn' : p.actionType === 'upgrade' ? 'Nâng cấp' : p.actionType === 'cancel' ? 'Hủy gói' : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-cafe-800">
                        {formatCurrency(p.amount)}
                        {p.creditStatus === 'applied' && (p.creditAmount ?? 0) > 0 && (
                          <span className="block text-[11px] text-cafe-400 font-normal">
                            {`Đã cấn trừ ${formatCurrency(p.creditAmount!)}`}
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
      )}

      <Modal open={paymentModal} onClose={() => { setPaymentModal(false); resetSelection(); }} title={pageTitle}>
        {selected && (
          <div className="space-y-4">
            {/* Gói đã chọn */}
            <div className="rounded-xl border border-bean/30 bg-bean-tint/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-ink">{selected.name}</h3>
                  <p className="text-xs text-cafe-500 mt-0.5">{selected.description}</p>
                </div>
                <span className="text-lg font-bold text-bean shrink-0">
                  {selected.isTrial ? 'Miễn phí' : formatCurrency(getPrice(timeSubsMap[selected.id] ?? [], selectedDur))}
                </span>
              </div>
              <ul className="mt-3 grid gap-1.5">
                {selected.features.slice(0, 4).map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-cafe-600"><Check className="w-3.5 h-3.5 text-pine shrink-0" />{f}</li>
                ))}
              </ul>
            </div>

            {/* Chọn thời hạn (gói trả phí) */}
            {!selected.isTrial && (
              <div>
                <label className="label-funcafe">Thời hạn</label>
                <div className="segmented">
                  {durations.map(d => (
                    <button key={d.value} onClick={() => setSelectedDur(d.value)}
                      className={`seg-item ${selectedDur === d.value ? 'seg-item-active' : ''}`}>{d.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Tóm tắt (giá gói + VAT = tổng thanh toán, khớp cách backend tính) */}
            {(() => {
              const price = getPrice(timeSubsMap[selected.id] ?? [], selectedDur);
              const vatRate = selected.isTrial ? 0 : (selected.vatRate ?? 10);
              const vatAmount = Math.round(price * vatRate / 100);
              const total = price + vatAmount;
              return (
                <div className="space-y-1.5 text-sm border-t border-line pt-3">
                  <div className="flex justify-between text-cafe-600"><span>Gói {selected.name}</span><span>{selected.isTrial ? 'Miễn phí' : formatCurrency(price)}</span></div>
                  {!selected.isTrial && <div className="flex justify-between text-cafe-500"><span>Thời hạn</span><span>{formatDuration(selectedDur)}</span></div>}
                  {!selected.isTrial && vatRate > 0 && (
                    <div className="flex justify-between text-cafe-500"><span>Thuế VAT ({vatRate}%)</span><span>{formatCurrency(vatAmount)}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-ink border-t border-line pt-1.5"><span>Tổng thanh toán</span><span className="text-bean text-base">{selected.isTrial ? 'Miễn phí' : formatCurrency(total)}</span></div>
                </div>
              );
            })()}

            {/* Phương thức: VNPay (gói trả phí) */}
            {!selected.isTrial && (
              <div className="space-y-2">
                <label className="label-funcafe">Phương thức thanh toán</label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-bean bg-bean-tint">
                  <span className="h-9 px-2.5 rounded-lg bg-white border border-line grid place-items-center shrink-0"><VnpayLogo className="h-4 w-auto" /></span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Thanh toán online qua VNPay</p>
                    <p className="text-xs text-cafe-500">ATM / QR / Visa · kích hoạt tự động</p>
                  </div>
                </div>
                <p className="text-xs text-cafe-500">Bạn sẽ được chuyển sang cổng VNPay. Sau khi thanh toán thành công, gói được <strong>kích hoạt tự động</strong> mà không cần admin duyệt.</p>
              </div>
            )}

            {submitError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setPaymentModal(false); resetSelection(); setSubmitError(''); }} className="btn-secondary flex-1" disabled={submitting}>Hủy</button>
              <button onClick={handleSubmit} className="btn-primary flex-1" disabled={submitting}>
                {submitting ? 'Đang xử lý...' : (selected.isTrial ? 'Kích hoạt Fun Free' : 'Thanh toán qua VNPay')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
