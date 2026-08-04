'use client';
import { useState, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import LockedBox from '@/components/ui/LockedBox';
import StatCard from '@/components/ui/StatCard';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/user/SectionCard';
import RevenueAiInsights from '@/components/user/RevenueAiInsights';
import { FilterBar } from '@/components/user/FilterBar';
import DateRangePicker from '@/components/ui/DateRangePicker';
import CafeRevenueComparison from '@/components/user/CafeRevenueComparison';
import { useAuth } from '@/context/AuthContext';
import { invoiceService } from '@/services';
import { useApi } from '@/hooks/use-api';
import { canViewRevenue } from '@/lib/permission';
import { formatCurrency, formatPaymentMethod } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { Download, TrendingUp, Receipt, DollarSign, BarChart3, AlertCircle, Store, Trophy } from 'lucide-react';
import { downloadExcel, toExcelDate } from '@/lib/utils';
import RevenueChart, { type RevenuePoint } from '@/components/user/RevenueChart';
import ChartModePicker from '@/components/user/ChartModePicker';
import type { Invoice } from '@/types';
import { fillGaps, keyLength, axisLabel, fullLabel, suggestMode, type ChartMode } from '@/lib/chart';

/** Ngày thanh toán dạng 'YYYY-MM-DD'; hóa đơn cũ thiếu paid_at thì lấy ngày tạo. */
const dayOf = (i: Invoice) => (i.paidAt || i.createdAt).slice(0, 10);

function groupBy(
  invoices: Invoice[],
  mode: ChartMode,
  from?: string,
  to?: string,
): RevenuePoint[] {
  const len = keyLength(mode);
  const groups: Record<string, number> = {};
  invoices.forEach(inv => {
    const k = (inv.paidAt || inv.createdAt).slice(0, len);
    groups[k] = (groups[k] ?? 0) + inv.totalAmount;
  });
  // fillGaps: ngày nghỉ / ngày ế phải hiện cột 0 chứ không được biến mất khỏi trục.
  return fillGaps(groups, mode, 0, from, to).map(({ key, value }) => ({
    label: axisLabel(key, mode),
    full: fullLabel(key, mode),
    value,
  }));
}

function computeTopItems(invoices: Invoice[]): { name: string; count: number; revenue: number }[] {
  const map: Record<string, { name: string; count: number; revenue: number }> = {};
  invoices.forEach(inv => {
    (inv.items ?? []).forEach(item => {
      const key = item.itemNameSnapshot;
      if (!map[key]) map[key] = { name: key, count: 0, revenue: 0 };
      map[key].count += item.quantity;
      // Gồm cả topping: ưu tiên totalPrice, fallback unitPrice*qty cho dữ liệu cũ
      map[key].revenue += item.totalPrice || item.unitPrice * item.quantity;
    });
  });
  return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
}

const today = new Date();
// Mốc ngày theo giờ địa phương (tránh lệch ngày do UTC lúc gần nửa đêm)
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

export default function RevenuePage() {
  const { user, cafes, activeCafeId } = useAuth();
  const { toast } = useToast();
  // null = người dùng CHƯA tự chọn quán -> bám theo quán đang quản lý. Đã chọn rồi
  // (kể cả chọn "Tất cả quán") thì giữ nguyên lựa chọn đó.
  // Không dùng useState(activeCafeId): lần render đầu AuthProvider chưa hydrate xong
  // nên activeCafeId còn null, mà giá trị khởi tạo của useState chỉ dùng đúng một lần.
  const [scope, setScope] = useState<string | null>(null);
  const effectiveScope = scope ?? activeCafeId ?? 'all';
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // Cùng mẫu ba trạng thái với `scope` ở trên: null = chưa tự chọn mốc -> bám theo
  // độ dài khoảng đang lọc. Chọn "12 tháng qua" mà biểu đồ vẫn vẽ 365 cột theo ngày
  // thì không đọc được gì; ngược lại chọn "7 ngày qua" mà gom theo tháng thì ra 1 cột.
  const [viewMode, setViewMode] = useState<ChartMode | null>(null);
  const effectiveMode = viewMode ?? suggestMode(fromDate, toDate);
  const [exporting, setExporting] = useState(false);

  // Gộp hóa đơn của TẤT CẢ quán người dùng sở hữu. /revenue/overview chỉ trả về
  // tổng và số theo tháng nên không đủ để lọc theo ngày hay tính top món —
  // ở đây cần dữ liệu từng hóa đơn.
  const cafeKey = cafes.map(c => c.id).join(',');
  const { data: invoices, loading, error } = useApi(
    async () => {
      if (cafes.length === 0) return [] as Invoice[];
      const perCafe = await Promise.all(cafes.map(c => invoiceService.listByCafe(c.id, c.name)));
      return perCafe.flat();
    },
    [cafeKey],
  );

  const all = useMemo(() => invoices ?? [], [invoices]);
  const scoped = useMemo(
    () => (effectiveScope === 'all' ? all : all.filter(i => i.cafeId === effectiveScope)),
    [all, effectiveScope],
  );
  const filtered = useMemo(() => {
    let r = scoped;
    if (fromDate) r = r.filter(i => dayOf(i) >= fromDate);
    if (toDate) r = r.filter(i => dayOf(i) <= toDate);
    return r;
  }, [scoped, fromDate, toDate]);

  const revenue = useMemo(() => filtered.reduce((s, i) => s + i.totalAmount, 0), [filtered]);
  const avgPerInvoice = filtered.length > 0 ? Math.round(revenue / filtered.length) : 0;
  const todayRevenue = useMemo(
    () => scoped.filter(i => dayOf(i) === todayStr).reduce((s, i) => s + i.totalAmount, 0),
    [scoped],
  );
  const chartData = useMemo(
    () => groupBy(filtered, effectiveMode, fromDate, toDate),
    [filtered, effectiveMode, fromDate, toDate],
  );
  const topItems = useMemo(() => computeTopItems(filtered), [filtered]);

  // Xếp hạng doanh thu từng quán trong khoảng đang lọc.
  const cafeRanking = useMemo(() => {
    const rows = cafes.map(c => {
      const list = filtered.filter(i => i.cafeId === c.id);
      return {
        id: c.id,
        name: c.name,
        revenue: list.reduce((s, i) => s + i.totalAmount, 0),
        count: list.length,
      };
    });
    return rows.sort((a, b) => b.revenue - a.revenue);
  }, [cafes, filtered]);
  const showComparison = effectiveScope === 'all' && cafes.length > 1;

  const rangeLabel = fromDate || toDate
    ? `${fromDate || 'đầu kỳ'} → ${toDate || 'nay'}`
    : 'toàn bộ thời gian';
  const scopeLabel = effectiveScope === 'all' ? 'tất cả quán' : cafes.find(c => c.id === effectiveScope)?.name ?? '';

  const handleExport = async () => {
    if (filtered.length === 0) {
      toast({ description: 'Không có hóa đơn nào trong khoảng đã lọc.' });
      return;
    }
    setExporting(true);
    try {
      // Cột "Quán" chỉ có nghĩa khi file gộp nhiều quán; đang xem riêng một quán mà
      // vẫn xuất thì cả cột lặp lại đúng một cái tên.
      const multi = effectiveScope === 'all' && cafes.length > 1;
      await downloadExcel(
        `doanh-thu-${todayStr}.xlsx`,
        'Doanh thu',
        [
          ...(multi ? [{ header: 'Quán', width: 22 }] : []),
          { header: 'Mã hóa đơn', width: 20 },
          { header: 'Bàn', width: 14 },
          { header: 'Phương thức', width: 16 },
          { header: 'Số tiền', width: 16, numFmt: '#,##0 "₫"' },
          { header: 'Ngày thanh toán', width: 20, numFmt: 'dd/mm/yyyy hh:mm' },
        ],
        filtered.map(inv => [
          ...(multi ? [inv.cafeName ?? ''] : []),
          inv.invoiceCode,
          inv.tableName,
          formatPaymentMethod(inv.paymentMethod),
          inv.totalAmount,
          toExcelDate(inv.paidAt || inv.createdAt),
        ]),
      );
    } catch {
      toast({ description: 'Xuất file thất bại, vui lòng thử lại.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  if (!canViewRevenue(user?.subscription)) {
    return (
      <div>
        <PageHeader title="Doanh thu" />
        <LockedBox title="Bạn chưa đăng ký gói dịch vụ"
          description="Đăng ký gói dịch vụ (kể cả dùng thử Fun Free 7 ngày) để xem biểu đồ doanh thu theo ngày/tháng, top món bán chạy và báo cáo chi tiết." />
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Doanh thu" description="Thống kê doanh thu chi tiết" />
        <LoadingSkeleton variant="table" rows={5} cols={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Doanh thu" description="Thống kê doanh thu chi tiết" />
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-4">
          <AlertCircle className="w-5 h-5" />
          <span>Không thể tải dữ liệu doanh thu.</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Doanh thu"
        description={cafes.length > 1 ? 'Thống kê quán đang quản lý, có thể xem gộp mọi quán' : 'Thống kê doanh thu chi tiết'}
        actions={
          <button onClick={handleExport} disabled={exporting} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />{exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        }
      />

      <FilterBar>
        {cafes.length > 1 && (
          <select
            className="input-funcafe !w-auto min-w-[170px]"
            value={effectiveScope}
            onChange={e => setScope(e.target.value)}
            aria-label="Chọn quán"
          >
            <option value="all">Tất cả quán ({cafes.length})</option>
            {cafes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t); }} />
        <ChartModePicker value={effectiveMode} onChange={setViewMode} from={fromDate} to={toDate} />
        <button onClick={() => { setScope(null); setFromDate(''); setToDate(''); setViewMode(null); }} className="btn-secondary">Xóa lọc</button>
      </FilterBar>

      <p className="text-sm text-cafe-500 mb-4">
        Đang xem <span className="font-semibold text-ink">{scopeLabel}</span> · {rangeLabel} · {filtered.length} hóa đơn
      </p>

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Doanh thu" value={formatCurrency(revenue)} icon={DollarSign} featured hint={`${filtered.length} hóa đơn`} />
        <StatCard label="Doanh thu hôm nay" value={formatCurrency(todayRevenue)} icon={TrendingUp} color="green" />
        <StatCard label="Trung bình/hóa đơn" value={formatCurrency(avgPerInvoice)} icon={BarChart3} color="blue" />
        {showComparison && cafeRanking[0]?.revenue > 0 ? (
          <StatCard
            label="Quán dẫn đầu"
            value={cafeRanking[0].name}
            icon={Trophy}
            color="yellow"
            hint={formatCurrency(cafeRanking[0].revenue)}
          />
        ) : (
          <StatCard label="Tổng hóa đơn" value={filtered.length} icon={Receipt} color="yellow" />
        )}
      </div>

      {/* Phân tích doanh thu bằng AI (gói Pro Max) */}
      <RevenueAiInsights />

      {/* Biểu đồ chiếm HÀNG RIÊNG. Trước đây nó chia đôi hàng với "Top 5 món", mà một
          chuỗi 62 ngày nhét trong nửa chiều rộng thì mỗi mốc chỉ còn vài pixel. */}
      <SectionCard
        title={`Doanh thu ${effectiveMode === 'day' ? 'theo ngày' : effectiveMode === 'year' ? 'theo năm' : 'theo tháng'}`}
        subtitle={`${chartData.length} mốc · ${rangeLabel}`}
        icon={BarChart3}
        className="mb-6"
      >
        <RevenueChart data={chartData} />
      </SectionCard>

      {/* Top 5 đứng một mình sẽ để trống nửa hàng -> ghép với bảng so sánh quán khi
          có nhiều quán; chỉ một quán thì cho nó chiếm trọn hàng. */}
      <div className={`grid grid-cols-1 gap-6 mb-6 ${showComparison ? 'lg:grid-cols-2' : ''}`}>
        <SectionCard title="Top 5 món bán chạy" icon={TrendingUp}>
          <div className="space-y-3.5">
            {topItems.length === 0 && (
              <p className="text-sm text-cafe-500 text-center py-6">Không có dữ liệu trong khoảng đã lọc.</p>
            )}
            {topItems.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${idx === 0 ? 'bg-gold text-white' : idx === 1 ? 'bg-cafe-300 text-white' : idx === 2 ? 'bg-bean/70 text-white' : 'bg-sand text-cafe-500'}`}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{item.name}</p>
                  <div className="flex gap-2 text-xs text-cafe-500">
                    <span>{item.count} lượt</span><span>·</span><span>{formatCurrency(item.revenue)}</span>
                  </div>
                </div>
                <div className="w-20 bg-sand rounded-full h-2 shrink-0 overflow-hidden">
                  <div className="bg-bean h-2 rounded-full" style={{ width: `${(item.count / topItems[0].count) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {showComparison && (
          <SectionCard
            title="So sánh doanh thu giữa các quán"
            subtitle={`Trong khoảng đang lọc · ${rangeLabel}`}
            icon={Store}
          >
            <CafeRevenueComparison rows={cafeRanking} />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
