'use client';
import { useState, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/user/SectionCard';
import RevenueAiInsights from '@/components/user/RevenueAiInsights';
import { FilterBar } from '@/components/user/FilterBar';
import DateRangePicker from '@/components/ui/DateRangePicker';
import CafeRevenueComparison from '@/components/user/CafeRevenueComparison';
import { useAuth } from '@/context/AuthContext';
import { invoiceService, revenueService } from '@/services';
import { useApi } from '@/hooks/use-api';
import { formatCurrency, formatPaymentMethod, ngayDiaPhuong } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { Download, TrendingUp, Receipt, DollarSign, BarChart3, AlertCircle, Store, Trophy } from 'lucide-react';
import { downloadExcel, toExcelDate } from '@/lib/utils';
import RevenueChart, { type RevenuePoint } from '@/components/user/RevenueChart';
import ChartModePicker from '@/components/user/ChartModePicker';
import type { Invoice } from '@/types';
import { fillGaps, keyLength, axisLabel, fullLabel, suggestMode, type ChartMode } from '@/lib/chart';

/** Ngày thanh toán dạng 'YYYY-MM-DD'; hóa đơn cũ thiếu paid_at thì lấy ngày tạo. */
// Ngày ghi nhận doanh thu, theo giờ ĐỊA PHƯƠNG — xem chú thích ở ngayDiaPhuong().
const dayOf = (i: Invoice) => ngayDiaPhuong(i.paidAt || i.createdAt);

function groupBy(
  invoices: Invoice[],
  mode: ChartMode,
  from?: string,
  to?: string,
): RevenuePoint[] {
  const len = keyLength(mode);
  const groups: Record<string, number> = {};
  invoices.forEach(inv => {
    // Cắt trên NGÀY ĐỊA PHƯƠNG chứ không trên chuỗi UTC gốc: hóa đơn thu lúc 00:23
    // sáng nếu cắt chuỗi UTC sẽ rơi vào cột của ngày hôm trước — và ở cuối tháng thì
    // rơi luôn sang cột tháng trước.
    const k = dayOf(inv).slice(0, len);
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
const nhan = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = nhan(today);

/**
 * Khoảng MẶC ĐỊNH khi mới mở trang: 30 ngày gần nhất.
 *
 * Trước đây mặc định là "toàn bộ thời gian", nghĩa là mỗi lần mở trang là tải về
 * TOÀN BỘ lịch sử bán hàng kể từ ngày khai trương của từng quán, kèm dòng món và
 * topping. Chi phí đó tăng đều theo tháng sử dụng: quán vượt nghìn đơn cần hơn
 * 12 giây chỉ để máy chủ dựng xong phản hồi, và không có gì chặn nó lớn tiếp.
 *
 * Ba mươi ngày là khoảng người ta thật sự nhìn khi mở trang doanh thu, và tải
 * nhanh hơn nhiều lần. Muốn xem xa hơn thì bộ chọn ngày vẫn còn nguyên — chỉ là
 * phải chọn, thay vì bắt mọi lượt mở trang phải trả giá cho nó.
 */
const SO_NGAY_MAC_DINH = 30;
const tuNgayMacDinh = nhan(new Date(today.getTime() - (SO_NGAY_MAC_DINH - 1) * 86_400_000));

export default function RevenuePage() {
  const { cafes, activeCafeId } = useAuth();
  const { toast } = useToast();
  // null = người dùng CHƯA tự chọn quán -> bám theo quán đang quản lý. Đã chọn rồi
  // (kể cả chọn "Tất cả quán") thì giữ nguyên lựa chọn đó.
  // Không dùng useState(activeCafeId): lần render đầu AuthProvider chưa hydrate xong
  // nên activeCafeId còn null, mà giá trị khởi tạo của useState chỉ dùng đúng một lần.
  const [scope, setScope] = useState<string | null>(null);
  const effectiveScope = scope ?? activeCafeId ?? 'all';
  const [fromDate, setFromDate] = useState(tuNgayMacDinh);
  const [toDate, setToDate] = useState(todayStr);
  // Cùng mẫu ba trạng thái với `scope` ở trên: null = chưa tự chọn mốc -> bám theo
  // độ dài khoảng đang lọc. Chọn "12 tháng qua" mà biểu đồ vẫn vẽ 365 cột theo ngày
  // thì không đọc được gì; ngược lại chọn "7 ngày qua" mà gom theo tháng thì ra 1 cột.
  const [viewMode, setViewMode] = useState<ChartMode | null>(null);
  const effectiveMode = viewMode ?? suggestMode(fromDate, toDate);
  const [exporting, setExporting] = useState(false);

  /**
   * Chỉ tải quán ĐANG XEM. Chọn "Tất cả quán" mới đi lấy hết.
   *
   * Bản cũ luôn tải hóa đơn của MỌI quán rồi lọc trong trình duyệt, kể cả khi màn
   * hình chỉ hiện đúng một quán — hai phần ba lượt gọi nặng nhất ứng dụng bị vứt đi
   * ngay sau khi tải xong.
   */
  const canTai = useMemo(
    () => (effectiveScope === 'all' ? cafes : cafes.filter(c => c.id === effectiveScope)),
    [cafes, effectiveScope],
  );
  const taiKey = canTai.map(c => c.id).join(',');

  const { data: ketQua, loading, error, refresh } = useApi(
    async () => {
      if (canTai.length === 0) return { hoaDon: [] as Invoice[], quanHong: [] as string[] };

      const hoaDon: Invoice[] = [];
      const quanHong: string[] = [];
      let loiDau: unknown = null;

      // TUẦN TỰ, không Promise.all/allSettled.
      //
      // Máy chủ ở bản triển khai phục vụ MỘT request tại một thời điểm, nên bắn song
      // song không rút ngắn được gì — nó chỉ khiến cả ba quán cùng bấm giờ hạn chờ
      // trong khi hai quán đang nằm xếp hàng. Quán được phục vụ sau cùng vì thế luôn
      // hết giờ trước khi tới lượt, dù bản thân nó chỉ cần vài giây.
      //
      // Chạy lần lượt thì mỗi quán được trọn hạn chờ của riêng nó. Tổng thời gian chờ
      // y hệt, nhưng dữ liệu về ĐỦ thay vì mất quán nặng nhất.
      for (const c of canTai) {
        try {
          hoaDon.push(...await invoiceService.listByCafe(c.id, c.name, {
            from: fromDate || undefined,
            to: toDate || undefined,
          }));
        } catch (e) {
          quanHong.push(c.name);
          loiDau ??= e;
        }
      }

      // Hỏng HẾT thì mới là lỗi thật — ném ra để useApi hiện màn hình lỗi.
      if (quanHong.length === canTai.length) {
        throw loiDau instanceof Error ? loiDau : new Error('Không tải được hóa đơn của quán nào.');
      }

      return { hoaDon, quanHong };
    },
    [taiKey, fromDate, toDate],
  );

  /**
   * "Doanh thu hôm nay" KHÔNG lấy từ danh sách hóa đơn ở trên: danh sách đó bị giới
   * hạn theo khoảng đang lọc, nên chọn một khoảng không chứa hôm nay là ô này về 0 —
   * sai, chứ không phải "chưa bán được gì". Máy chủ cộng sẵn số này trong
   * /revenue/overview, cho từng quán, và không phụ thuộc bộ lọc.
   */
  const { data: tongQuan } = useApi(() => revenueService.overview(), []);

  const all = useMemo(() => ketQua?.hoaDon ?? [], [ketQua]);
  const quanHong = ketQua?.quanHong ?? [];
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
  const todayRevenue = useMemo(() => {
    if (!tongQuan) return 0;
    if (effectiveScope === 'all') return tongQuan.today;
    return tongQuan.cafes.find(c => c.cafeId === effectiveScope)?.today ?? 0;
  }, [tongQuan, effectiveScope]);
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
      // Tên tệp mang theo ĐÚNG khoảng đã xuất. Trang mặc định xem 30 ngày gần nhất
      // chứ không phải toàn bộ thời gian, nên một cái tên chỉ có ngày xuất sẽ khiến
      // người nhận tưởng đây là số liệu từ đầu tới giờ.
      await downloadExcel(
        `doanh-thu-${fromDate || 'dau-ky'}_den_${toDate || todayStr}.xlsx`,
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
    } catch (e) {
      // KHÔNG nuốt lý do. "Xuất file thất bại, vui lòng thử lại" là lời khuyên sai
      // trong hầu hết trường hợp: thử lại bao nhiêu lần cũng hỏng như nhau. Ba nguyên
      // nhân thật, mỗi cái cần một hành động khác hẳn:
      //   · bộ tạo tệp (exceljs) được nạp động nên là gói mã TẢI RIÊNG lúc bấm nút —
      //     bản dựng cũ còn nằm trong trình duyệt thì gói đó 404 và chỉ mình nút này
      //     hỏng, phần còn lại của trang vẫn chạy. Đây là ca hay gặp nhất.
      //   · trình duyệt chặn tải tệp tự động.
      //   · dữ liệu có ô mà bộ tạo tệp không ghi được.
      console.error('[Xuất Excel] thất bại:', e);
      const chiTiet = e instanceof Error ? e.message : String(e);
      const laLoiTaiMa = /chunk|import|dynamically imported|Failed to fetch|NetworkError/i.test(chiTiet);
      toast({
        description: laLoiTaiMa
          ? 'Không tải được bộ tạo tệp Excel. Trang đang chạy trên bản dựng cũ — tải lại trang bằng Ctrl+F5 rồi bấm lại.'
          : `Xuất file thất bại: ${chiTiet}`,
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  // KHÔNG khóa trang này theo gói. Xem doanh thu là quyền cơ bản của chủ quán với
  // dữ liệu bán hàng của chính họ, kể cả khi chưa mua gói hay gói đã hết hạn —
  // backend cũng cho đọc order không cần gói. Ở đây từng có một nhánh khóa gọi
  // canViewRevenue(), nhưng hàm đó luôn trả true nên nhánh chưa từng chạy.

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
        <div className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            {/* Nói ra lý do máy chủ trả về, đừng nuốt. "Không thể tải dữ liệu" một mình
                không cho người dùng biết nên đợi, nên thử lại, hay nên gọi ai. */}
            <p className="font-semibold">Không tải được hóa đơn của quán nào.</p>
            <p className="mt-0.5 text-red-600/90">{error}</p>
            <button onClick={refresh} className="btn-secondary mt-3">Thử lại</button>
          </div>
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

      {/* Tải được một phần. Số dưới đây là THẬT nhưng THIẾU — nói rõ thiếu của quán
          nào, thay vì để chủ quán đọc một con số nhỏ hơn thực tế mà không hay biết. */}
      {quanHong.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              Số liệu đang thiếu {quanHong.length === 1 ? 'quán' : `${quanHong.length} quán`}: {quanHong.join(' · ')}
            </p>
            <p className="mt-0.5">
              Các quán còn lại đã tải xong và số bên dưới là của những quán đó.
              Quán nhiều hóa đơn có thể tải quá lâu — thử lại thường là được.
            </p>
            <button onClick={refresh} className="btn-secondary mt-3">Tải lại</button>
          </div>
        </div>
      )}

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
        {/* Về MẶC ĐỊNH (30 ngày gần nhất), không về "toàn bộ thời gian": nút này hay
            được bấm theo phản xạ, và đưa về toàn bộ thời gian là ném người dùng
            thẳng vào lượt tải nặng nhất mà họ không hề chọn. */}
        <button
          onClick={() => { setScope(null); setFromDate(tuNgayMacDinh); setToDate(todayStr); setViewMode(null); }}
          className="btn-secondary"
        >
          Xóa lọc
        </button>
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
