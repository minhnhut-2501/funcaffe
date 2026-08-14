'use client';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import { paymentService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDateTime, formatDuration, ngayDiaPhuong } from '@/lib/format';
import DateRangePicker from '@/components/ui/DateRangePicker';
import type { Payment, PaymentStatus, CreditStatus } from '@/types';
import { Eye, CreditCard } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import Pagination, { usePagination } from '@/components/ui/Pagination';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge, { type Tone } from '@/components/user/StatusBadge';

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [packageFilter, setPackageFilter] = useState<string>('all');
  // Đối soát với sao kê ngân hàng luôn là "những giao dịch ĐÃ THU trong khoảng này",
  // nên thiếu hai bộ lọc dưới đây thì phải dò bằng mắt trên cả bảng.
  // Hai lựa chọn, không phải bốn. Câu hỏi khi đối soát chỉ có một: giao dịch này có
  // tiền vào tài khoản hay không. CSDL ghi ba dạng KHÔNG có tiền — 'rejected' (khách
  // hủy trên cổng), 'failed' (đơn treo quá hạn bị dọn), 'pending' (bản ghi cũ còn
  // sót; đơn cổng đang chờ đã bị máy chủ lọc bỏ). Bắt admin nhớ ba từ đó rồi lọc ba
  // lần mới ra "những giao dịch không thu được" là bắt họ làm việc của máy.
  const [statusFilter, setStatusFilter] = useState<'all' | 'thanh-cong' | 'that-bai'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewPayment, setViewPayment] = useState<Payment | null>(null);

  // Thiếu cờ này thì trong lúc chờ máy chủ, bảng rỗng + EmptyState hiện ra câu
  // "chưa có giao dịch nào" — một câu SAI, và là thứ admin nhìn thấy đầu tiên.
  const [loading, setLoading] = useState(true);

  const load = () => paymentService.list().then(setPayments)
    .catch(() => toast({ description: 'Không thể tải danh sách thanh toán', variant: 'destructive' }))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  // Danh sách gói lấy từ chính dữ liệu giao dịch: luôn khớp với thứ đang hiển thị,
  // và không liệt kê gói chưa ai mua (lọc ra danh sách rỗng thì vô nghĩa).
  const packageNames = useMemo(
    () => [...new Set(payments.map(p => p.packageName).filter(Boolean))].sort(),
    [payments],
  );

  const filtered = payments.filter(p => {
    // ngayDiaPhuong: máy chủ gửi chuỗi ISO theo UTC. Cắt 10 ký tự đầu thì giao dịch
    // lúc 05:00 sáng 01/08 giờ Việt Nam bị xếp vào 31/07 — lọc "tháng 8" sẽ thiếu nó.
    const ngay = ngayDiaPhuong(p.createdAt);
    // 'that-bai' là "mọi thứ KHÔNG phải paid", không phải danh sách liệt kê: thêm một
    // trạng thái mới ở máy chủ mà quên sửa chỗ này thì nó vẫn lọc ra được, thay vì
    // biến mất khỏi cả hai lựa chọn.
    const hopTrangThai = statusFilter === 'all'
      || (statusFilter === 'thanh-cong' ? p.status === 'paid' : p.status !== 'paid');
    return (packageFilter === 'all' || p.packageName === packageFilter)
      && hopTrangThai
      && (!fromDate || ngay >= fromDate)
      && (!toDate || ngay <= toDate)
      && (p.userName.toLowerCase().includes(search.toLowerCase()) || p.transactionCode.toLowerCase().includes(search.toLowerCase()));
  });

  // Tổng của phần ĐANG HIỂN THỊ — con số để đặt cạnh sao kê. Chỉ cộng giao dịch đã
  // thu: pending/failed/rejected chưa từng có đồng nào vào tài khoản.
  const tongDaThu = filtered.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  // Cắt trang SAU khi đã lọc và tìm kiếm.
  const paging = usePagination(filtered, undefined, [search, packageFilter, statusFilter, fromDate, toDate]);

  // Chỉ 'paid' được tô màu thành công. Ba dạng còn lại để màu trầm chứ không tô đỏ:
  // khách bỏ dở giữa cổng thanh toán là chuyện thường ngày, không phải sự cố — tô đỏ
  // thì trang đối soát lúc nào cũng đỏ lòm và admin thôi không nhìn màu nữa.
  const statusTone: Record<PaymentStatus, Tone> = {
    pending: 'neutral',
    rejected: 'neutral',
    paid: 'success',
    failed: 'neutral',
  };

  // Nhãn nói ĐÚNG chuyện đã xảy ra. Hai nhãn cũ, 'Chờ duyệt' và 'Từ chối', được đặt
  // từ thời admin duyệt tay từng giao dịch — khâu đó gỡ ngày 22/07/2026, nay không
  // còn nút duyệt nào. Giữ chúng lại là hứa với admin một việc phải làm mà hệ thống
  // không có chỗ để làm.
  const statusLabel: Record<PaymentStatus, string> = {
    // Bản ghi cũ còn sót: đơn cổng đang chờ đã bị máy chủ lọc bỏ khỏi bảng này.
    pending: 'Chưa hoàn tất',
    // Cổng báo mã lỗi khác '00' — gần như luôn là khách bấm hủy giữa chừng.
    rejected: 'Khách hủy',
    paid: 'Đã thanh toán',
    // Đơn treo quá hạn chờ, bị dọn ở lần mua sau.
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
      {/* KHÔNG gọi là "Quản lý": trang này chỉ đối soát, không sửa được gì trên
          giao dịch. Việc khóa tài khoản đã nằm ở trang Quản lý người dùng — đặt
          thêm một nút Khóa ở đây là tác động lên đối tượng khác với trang. */}
      <PageHeader title="Giao dịch thanh toán" description={`${payments.length} giao dịch · chỉ xem để đối soát`} />

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
        <select
          className="input-funcafe !w-auto min-w-[150px]"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          aria-label="Lọc theo trạng thái giao dịch"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="thanh-cong">Thành công</option>
          <option value="that-bai">Thất bại</option>
        </select>
        <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t); }} />
        {(statusFilter !== 'all' || packageFilter !== 'all' || fromDate || toDate || search) && (
          <button
            onClick={() => { setSearch(''); setPackageFilter('all'); setStatusFilter('all'); setFromDate(''); setToDate(''); }}
            className="btn-secondary"
          >
            Xóa lọc
          </button>
        )}
      </FilterBar>

      {/* Con số để đặt cạnh sao kê ngân hàng: tổng của đúng phần đang lọc, không phải
          tổng cả bảng. Không có nó thì admin phải tự cộng bằng tay. */}
      <p className="mt-3 mb-4 text-sm text-cafe-600">
        <span className="font-semibold text-ink">{filtered.length}</span> giao dịch khớp bộ lọc ·
        đã thu <span className="font-semibold text-pine">{formatCurrency(tongDaThu)}</span>
      </p>

      {loading ? <LoadingSkeleton variant="table" rows={8} cols={7} /> : (
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
          <tbody className="stagger divide-y divide-line/70">
            {paging.pageRows.map(p => (
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
                <td className="px-4 py-3 text-cafe-500">{formatDuration(p.durationValue, p.durationUnit)}</td>
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
                  <div className="flex items-center justify-end">
                    <button onClick={() => setViewPayment(p)} title="Xem chi tiết" className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
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
      )}

      {!loading && (
        <Pagination page={paging.page} lastPage={paging.lastPage} total={paging.total}
          onChange={paging.setPage} unit="giao dịch" />
      )}

      {/* 2 cột thay vì 1: 13 dòng nhãn:giá trị xếp dọc trong khung 448px thì cao
          hơn cả màn hình, phải kéo mới đọc hết một giao dịch. */}
      <Modal
        open={!!viewPayment}
        onClose={() => setViewPayment(null)}
        title={`Giao dịch ${viewPayment?.transactionCode}`}
        size="lg"
        footer={<button onClick={() => setViewPayment(null)} className="btn-secondary w-full">Đóng</button>}
      >
        {viewPayment && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              { label: 'Mã giao dịch', value: viewPayment.transactionCode },
              { label: 'Người dùng', value: viewPayment.userName },
              // Email dài bị ngắt giữa chừng nếu ép vào nửa cột.
              { label: 'Email', value: viewPayment.userEmail, wide: true },
              { label: 'Loại GD', value: viewPayment.actionType === 'new' ? 'Mới' : viewPayment.actionType === 'renew' ? 'Gia hạn' : viewPayment.actionType === 'upgrade' ? 'Nâng cấp' : viewPayment.actionType === 'cancel' ? 'Hủy gói' : '—' },
              { label: 'Gói đăng ký', value: viewPayment.packageName },
              { label: 'Thời hạn', value: formatDuration(viewPayment.durationValue, viewPayment.durationUnit) },
              { label: 'Số tiền', value: formatCurrency(viewPayment.amount) },
              { label: 'Trạng thái', value: statusLabel[viewPayment.status] },
              { label: 'Ngày tạo', value: formatDateTime(viewPayment.createdAt) },
              // `paid_at` — thời điểm CỔNG xác nhận đã thu tiền, không phải lúc ai đó
              // duyệt: không còn khâu duyệt tay nào để mà ghi ngày.
              ...(viewPayment.confirmedAt ? [{ label: 'Ngày thanh toán', value: formatDateTime(viewPayment.confirmedAt) }] : []),
              ...(hasCredit(viewPayment) ? [
                { label: 'Tiền cấn trừ', value: formatCurrency(viewPayment.creditAmount ?? 0) },
                { label: 'Trạng thái cấn trừ', value: creditLabel[viewPayment.creditStatus ?? 'none'] },
              ] : []),
              ...(viewPayment.note ? [{ label: 'Ghi chú', value: viewPayment.note, wide: true }] : []),
            ].map(r => (
              <div key={r.label} className={`min-w-0 ${(r as { wide?: boolean }).wide ? 'col-span-2' : ''}`}>
                <dt className="text-xs text-cafe-500 mb-0.5">{r.label}</dt>
                <dd className="text-ink font-medium break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </div>
  );
}
