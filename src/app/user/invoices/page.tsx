'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import { inBill, khiVeXong } from '@/lib/in-bill';
import LockedButton from '@/components/ui/LockedButton';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { invoiceService } from '@/services';
import { useApi } from '@/hooks/use-api';
import { canPrint } from '@/lib/permission';
import { formatCurrency, formatDateTime, formatPaymentMethod, ngayDiaPhuong } from '@/lib/format';
import type { Invoice } from '@/types';
import { Eye, Printer, RotateCcw, AlertCircle, Receipt } from 'lucide-react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import Pagination, { usePagination } from '@/components/ui/Pagination';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import DateRangePicker from '@/components/ui/DateRangePicker';
import StatusBadge from '@/components/user/StatusBadge';
import PhieuTinhTien from '@/components/user/PhieuTinhTien';

export default function InvoicesPage() {
  const { user, shops, activeShopId } = useAuth();
  // Thông tin quán cho phiếu in lấy từ quán đang chọn (bỏ snapshot trong invoices).
  const activeShop = shops.find(c => c.id === activeShopId);
  const pkg = user?.subscription.packageType ?? 'none';
  const { data: invoices, loading, error } = useApi(() => invoiceService.list());
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  /** Đã bấm in từ bảng, đang chờ hộp thoại vẽ xong. */
  const [choIn, setChoIn] = useState(false);
  /**
   * Đang đi lấy dòng món cho tờ đang mở.
   *
   * Danh sách nạp về ở dạng gọn — không kèm dòng món (xem `invoiceService.list`), nên
   * mở một tờ ra là phải hỏi máy chủ lần nữa. Phần đầu phiếu (mã, bàn, giờ, tổng tiền)
   * đã có sẵn nên vẽ được ngay; chỉ khúc bảng món là phải chờ.
   */
  const [dangTaiChiTiet, setDangTaiChiTiet] = useState(false);
  const { toast } = useToast();

  /**
   * Mở một hóa đơn, và chỉ IN sau khi đã có đủ dòng món.
   *
   * `roiIn` không được bật trước lúc chi tiết về: bản in dựng từ chính khối .print-area
   * trong hộp thoại này, nên in lúc bảng món còn rỗng là đưa khách một tờ phiếu KHÔNG
   * CÓ MÓN NÀO mà vẫn ghi đủ tổng tiền — sai nguy hiểm hơn hẳn một tờ giấy trắng, vì
   * nó trông như một hóa đơn thật.
   */
  const moHoaDon = async (inv: Invoice, roiIn = false) => {
    setViewInvoice(inv);
    setDangTaiChiTiet(true);
    try {
      setViewInvoice(await invoiceService.getById(inv.id));
      if (roiIn) setChoIn(true);
    } catch {
      toast({ description: 'Không tải được chi tiết hóa đơn, vui lòng thử lại.', variant: 'destructive' });
    } finally {
      setDangTaiChiTiet(false);
    }
  };

  // Ba cách thu tiền ở quầy: tiền mặt, khách chuyển khoản qua VietQR, và trả qua cổng
  // VNPay. Nhóm 'transfer' gom 'vietqr' cùng giá trị cũ 'transfer' còn sót trong CSDL.
  //
  // VNPay tách riêng chứ không nhét chung vào 'Chuyển khoản': tiền VietQR chạy thẳng
  // vào tài khoản quán, còn tiền VNPay đi qua cổng — hai dòng tiền khác nhau, đối soát
  // cũng ở hai nơi khác nhau.
  const matchesMethod = (method?: string) => {
    if (methodFilter === 'all') return true;
    if (methodFilter === 'cash') return method === 'cash';
    if (methodFilter === 'vnpay') return method === 'vnpay';

    return method !== 'cash' && method !== 'vnpay';
  };

  const filtered = (invoices ?? []).filter(inv => {
    // BUG-24 FIX: Lọc theo paidAt (ngày thanh toán) thay vì createdAt
    const paidDate = ngayDiaPhuong(inv.paidAt || inv.createdAt);
    return (
      matchesMethod(inv.paymentMethod) &&
      (search === '' || inv.invoiceCode.toLowerCase().includes(search.toLowerCase()) || inv.tableName.includes(search) ||
        (inv.orderType === 'takeaway' && 'mang về'.includes(search.toLowerCase()))) &&
      (fromDate === '' || paidDate >= fromDate) &&
      (toDate === '' || paidDate <= toDate)
    );
  });

  // Cắt trang SAU khi đã lọc và tìm kiếm.
  //
  // Hook này phải gọi TRƯỚC hai nhánh return bên dưới. Đặt sau chúng thì lượt vẽ đầu
  // (đang tải) không gọi hook, lượt sau lại gọi — React báo "change in the order of
  // Hooks" và trang hỏng hẳn.
  const paging = usePagination(filtered, undefined, [search, methodFilter, fromDate, toDate]);

  // In từ NÚT TRONG BẢNG: phải mở hóa đơn đó ra trước rồi mới in.
  //
  // Bản in được dựng bằng cách ẩn toàn bộ trang trừ khối .print-area, mà khối đó chỉ
  // tồn tại bên trong hộp thoại chi tiết. Gọi thẳng window.print() từ dòng trong bảng
  // — như trước đây — thì hộp thoại chưa mở, không có .print-area nào, và máy in nhận
  // được MỘT TỜ TRẮNG. Lỗi này không lộ ra trên màn hình nên rất dễ lọt.
  useEffect(() => {
    if (!choIn || !viewInvoice) return;

    // Đợi hộp thoại vẽ VÀ chạy xong hiệu ứng mở rồi mới in — xem `khiVeXong`.
    return khiVeXong(() => {
      inBill(viewInvoice.invoiceCode);
      setChoIn(false);
    });
  }, [choIn, viewInvoice]);

  /**
   * Đến thẳng một hóa đơn từ nơi khác: `/user/invoices?hoadon=<id>`.
   *
   * Màn hình Bán hàng dùng đường này ngay sau khi thu tiền. Trước đây nút "In hóa
   * đơn" ở đó chỉ mở DANH SÁCH hóa đơn, thu ngân phải tự dò lại tờ vừa lập trong khi
   * khách đang đứng chờ — và nếu dò nhầm dòng thì đưa khách hóa đơn của bàn khác.
   *
   * Mở đúng hộp thoại chi tiết cũng bảo đảm bản in sau thanh toán và bản in lại từ
   * trang này là MỘT: cùng một khối .print-area, không có bản thứ hai để lệch nhau.
   */
  useEffect(() => {
    if (!invoices?.length) return;
    const cauHoi = new URLSearchParams(window.location.search).get('hoadon');
    if (!cauHoi) return;

    const canIn = invoices.find(inv => inv.id === cauHoi || inv.invoiceCode === cauHoi);
    // Qua moHoaDon chứ không setViewInvoice thẳng: bản trong danh sách là bản GỌN,
    // không có dòng món nào. Đây là đường thu ngân đi ngay sau khi thu tiền.
    if (canIn) void moHoaDon(canIn);
    // Xóa tham số khỏi thanh địa chỉ: tải lại trang không nên mở lại hộp thoại cũ.
    window.history.replaceState(null, '', window.location.pathname);
    // `moHoaDon` cố ý KHÔNG nằm trong danh sách phụ thuộc: nó được dựng lại ở mỗi lượt
    // vẽ, mà chính nó gọi setState — đưa vào là hiệu ứng tự kích lại vòng vòng. Hiệu
    // ứng này chỉ được chạy khi danh sách vừa về, đúng một lần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  if (loading) return <div><PageHeader title="Hóa đơn" description="Xem, lọc và in hóa đơn thanh toán." /><LoadingSkeleton variant="table" rows={6} cols={7} /></div>;
  if (error) return <div><PageHeader title="Hóa đơn" /><div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải danh sách hóa đơn.</span></div></div>;

  const resetFilters = () => { setSearch(''); setMethodFilter('all'); setFromDate(''); setToDate(''); };

  return (
    <div>
      <PageHeader title="Hóa đơn" description="Xem, lọc và in hóa đơn thanh toán." />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã hóa đơn..." />
        <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t); }} />
        <select className="input-funcafe !w-auto min-w-[150px]" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
          <option value="all">Tất cả phương thức</option>
          <option value="cash">Tiền mặt</option>
          <option value="transfer">Chuyển khoản</option>
          <option value="vnpay">VNPay</option>
        </select>
        <button onClick={resetFilters} className="btn-secondary">
          <RotateCcw className="w-3.5 h-3.5" />Đặt lại
        </button>
      </FilterBar>

      <div className="bg-white rounded-2xl border border-line overflow-x-auto shadow-soft">
        <table className="w-full text-sm min-w-[750px]">
          <thead className="bg-sand border-b border-line">
            <tr>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Mã hóa đơn</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Mã order</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Bàn</th>
              <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Tổng tiền</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Phương thức</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Trạng thái</th>
              <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Ngày tạo</th>
              <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Hành động</th>
            </tr>
          </thead>
          <tbody className="stagger divide-y divide-line/70">
            {paging.pageRows.map(inv => (
              <tr key={inv.id} className="hover:bg-sand/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-bold text-bean">{inv.invoiceCode}</td>
                <td className="px-4 py-3 font-mono text-xs text-cafe-500">{inv.orderCode}</td>
                <td className="px-4 py-3 text-ink">
                  {inv.orderType === 'takeaway'
                    ? <span className="font-semibold text-gold-deep">Mang về</span>
                    : inv.tableName}
                </td>
                <td className="px-4 py-3 font-semibold text-ink text-right">{formatCurrency(inv.totalAmount)}</td>
                <td className="px-4 py-3 text-cafe-600">{formatPaymentMethod(inv.paymentMethod)}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone="success">Đã thanh toán</StatusBadge>
                </td>
                <td className="px-4 py-3 text-cafe-500 text-xs">{formatDateTime(inv.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => moHoaDon(inv)} title="Xem chi tiết" className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    {canPrint(pkg) ? (
                      <button onClick={() => moHoaDon(inv, true)} title="In hóa đơn" className="p-2 text-cafe-500 hover:text-bean hover:bg-sand rounded-lg transition-colors">
                        <Printer className="w-4 h-4" />
                      </button>
                    ) : (
                      <LockedButton variant="secondary" className="p-2 text-xs"><Printer className="w-3.5 h-3.5" /></LockedButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8}>
                {(invoices ?? []).length === 0
                  ? <EmptyState icon={Receipt} title="Bạn chưa có hóa đơn nào" description="Hóa đơn sẽ xuất hiện ở đây sau khi bạn thanh toán đơn hàng đầu tiên." />
                  : <EmptyState icon={Receipt} title="Không tìm thấy hóa đơn nào" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={paging.page} lastPage={paging.lastPage} total={paging.total}
        onChange={paging.setPage} unit="hóa đơn" className="no-print" />

      <Modal
        open={!!viewInvoice}
        onClose={() => setViewInvoice(null)}
        title={`Chi tiết hóa đơn ${viewInvoice?.invoiceCode ?? ''}`}
        size="lg"
        footer={
          // no-print: footer nằm ngoài .print-area nên khi in đã bị ẩn sẵn, nhưng
          // giữ class để nó không chiếm chỗ trên bản in.
          <div className="flex gap-2 no-print">
            {canPrint(pkg) ? (
              // Khóa trong lúc chờ dòng món: in sớm là ra một tờ phiếu không có món
              // nào mà vẫn ghi đủ tổng tiền.
              <button onClick={() => inBill(viewInvoice?.invoiceCode)} disabled={dangTaiChiTiet} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
                <Printer className="w-4 h-4" />{dangTaiChiTiet ? 'Đang tải...' : 'In hóa đơn'}
              </button>
            ) : (
              <LockedButton variant="secondary" className="flex-1 flex items-center justify-center gap-2 text-sm">
                <Printer className="w-4 h-4" />In hóa đơn
              </LockedButton>
            )}
            <button onClick={() => setViewInvoice(null)} className="btn-primary flex-1 text-sm">Đóng</button>
          </div>
        }
      >
        {viewInvoice && (
          <PhieuTinhTien
            hoaDon={viewInvoice}
            tenQuan={activeShop?.name}
            diaChiQuan={activeShop?.address}
            dienThoaiQuan={activeShop?.phone}
            dangTaiChiTiet={dangTaiChiTiet}
          />
        )}
      </Modal>
    </div>
  );
}
