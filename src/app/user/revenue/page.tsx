'use client';
import { useState, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/user/SectionCard';
import RevenueAiInsights from '@/components/user/RevenueAiInsights';
import { FilterBar } from '@/components/user/FilterBar';
import DateRangePicker from '@/components/ui/DateRangePicker';
import ShopRevenueComparison from '@/components/user/ShopRevenueComparison';
import { useAuth } from '@/context/AuthContext';
import { invoiceService, revenueService } from '@/services';
import { useApi } from '@/hooks/use-api';
import { formatCurrency, formatPaymentMethod } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { Download, TrendingUp, Receipt, DollarSign, BarChart3, AlertCircle, Store, Trophy } from 'lucide-react';
import { downloadExcel, toExcelDate } from '@/lib/utils';
import RevenueChart, { type RevenuePoint } from '@/components/user/RevenueChart';
import ChartModePicker from '@/components/user/ChartModePicker';
import type { Invoice } from '@/types';
import { fillGaps, keyLength, axisLabel, fullLabel, suggestMode, type ChartMode } from '@/lib/chart';

/**
 * Gom các mốc NGÀY do máy chủ trả về thành mốc của biểu đồ (ngày / tháng / năm).
 *
 * Cắt chuỗi ở đây là an toàn, khác hẳn với việc cắt một chuỗi ISO thô: khóa trong
 * `byDay` đã là ngày ĐỊA PHƯƠNG do máy chủ dựng sẵn ('YYYY-MM-DD', giờ Việt Nam),
 * nên `slice(0, 7)` ra đúng tháng địa phương. Cắt trên mốc UTC gốc thì hóa đơn thu
 * lúc 00:23 sáng rơi sang cột hôm trước, và ở cuối tháng thì rơi sang cả tháng trước.
 */
function groupBuckets(
  byDay: { key: string; value: number }[],
  mode: ChartMode,
  from?: string,
  to?: string,
): RevenuePoint[] {
  const len = keyLength(mode);
  const groups: Record<string, number> = {};
  byDay.forEach(({ key, value }) => {
    const k = key.slice(0, len);
    groups[k] = (groups[k] ?? 0) + value;
  });
  // fillGaps: ngày nghỉ / ngày ế phải hiện cột 0 chứ không được biến mất khỏi trục.
  return fillGaps(groups, mode, 0, from, to).map(({ key, value }) => ({
    label: axisLabel(key, mode),
    full: fullLabel(key, mode),
    value,
  }));
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
  const { shops, activeShopId } = useAuth();
  const { toast } = useToast();
  // null = người dùng CHƯA tự chọn quán -> bám theo quán đang quản lý. Đã chọn rồi
  // (kể cả chọn "Tất cả quán") thì giữ nguyên lựa chọn đó.
  // Không dùng useState(activeShopId): lần render đầu AuthProvider chưa hydrate xong
  // nên activeShopId còn null, mà giá trị khởi tạo của useState chỉ dùng đúng một lần.
  const [scope, setScope] = useState<string | null>(null);
  const effectiveScope = scope ?? activeShopId ?? 'all';
  const [fromDate, setFromDate] = useState(tuNgayMacDinh);
  const [toDate, setToDate] = useState(todayStr);
  // Cùng mẫu ba trạng thái với `scope` ở trên: null = chưa tự chọn mốc -> bám theo
  // độ dài khoảng đang lọc. Chọn "12 tháng qua" mà biểu đồ vẫn vẽ 365 cột theo ngày
  // thì không đọc được gì; ngược lại chọn "7 ngày qua" mà gom theo tháng thì ra 1 cột.
  const [viewMode, setViewMode] = useState<ChartMode | null>(null);
  const effectiveMode = viewMode ?? suggestMode(fromDate, toDate);
  const [exporting, setExporting] = useState(false);

  /** Các quán nằm trong phạm vi đang xem — dùng cho nhãn và cho lượt xuất Excel. */
  const canTai = useMemo(
    () => (effectiveScope === 'all' ? shops : shops.filter(c => c.id === effectiveScope)),
    [shops, effectiveScope],
  );

  /**
   * MỘT lượt gọi, máy chủ đã cộng sẵn.
   *
   * Bản trước tải toàn bộ hóa đơn của TỪNG quán — kèm dòng món và topping — rồi cộng
   * trong trình duyệt. Với ba quán demo (gần 2.000 hóa đơn) đó là ba request nặng nối
   * đuôi nhau, đo trên bản triển khai mất 12,3 giây, và chi phí ấy còn lớn dần theo
   * mỗi tháng bán hàng. Tất cả chỉ để hiện vài chục con số.
   *
   * Giờ số liệu đi thẳng từ `/revenue/summary`: chi phí tỉ lệ với số CỘT trên biểu đồ
   * chứ không còn tỉ lệ với số hóa đơn tích lũy.
   *
   * Không còn khái niệm "tải được một phần": một request thì hoặc xong hoặc hỏng, và
   * khi hỏng thì hỏng nhanh chứ không để người dùng ngồi nhìn số liệu thiếu quán.
   */
  const { data: soLieu, loading, error, refresh } = useApi(
    () => revenueService.summary({
      from: fromDate || undefined,
      to: toDate || undefined,
      shopId: effectiveScope,
    }),
    [effectiveScope, fromDate, toDate],
  );

  /**
   * "Doanh thu hôm nay" KHÔNG lấy từ danh sách hóa đơn ở trên: danh sách đó bị giới
   * hạn theo khoảng đang lọc, nên chọn một khoảng không chứa hôm nay là ô này về 0 —
   * sai, chứ không phải "chưa bán được gì". Máy chủ cộng sẵn số này trong
   * /revenue/overview, cho từng quán, và không phụ thuộc bộ lọc.
   */
  const { data: tongQuan } = useApi(() => revenueService.overview(), []);

  // Máy chủ đã lọc theo khoảng VÀ theo quán rồi — không cắt lại lần nữa ở đây. Lọc
  // hai lần là mở đường cho hai bên lệch nhau, mà bên thua luôn là con số trên màn hình.
  const revenue = soLieu?.total ?? 0;
  const soHoaDon = soLieu?.count ?? 0;
  const avgPerInvoice = soHoaDon > 0 ? Math.round(revenue / soHoaDon) : 0;
  const todayRevenue = useMemo(() => {
    if (!tongQuan) return 0;
    if (effectiveScope === 'all') return tongQuan.today;
    return tongQuan.shops.find(c => c.shopId === effectiveScope)?.today ?? 0;
  }, [tongQuan, effectiveScope]);
  const chartData = useMemo(
    () => groupBuckets(soLieu?.byDay ?? [], effectiveMode, fromDate, toDate),
    [soLieu, effectiveMode, fromDate, toDate],
  );
  // Máy chủ trả 8 món xếp sẵn theo doanh thu; màn hình chỉ hiện 5.
  const topItems = useMemo(() => (soLieu?.topItems ?? []).slice(0, 5), [soLieu]);

  // Xếp hạng doanh thu từng quán trong khoảng đang lọc.
  const shopRanking = useMemo(() => {
    const rows = (soLieu?.shops ?? []).map(c => ({
      id: c.shopId,
      name: c.shopName,
      revenue: c.total,
      count: c.count,
    }));
    return rows.sort((a, b) => b.revenue - a.revenue);
  }, [soLieu]);
  const showComparison = effectiveScope === 'all' && shops.length > 1;

  const rangeLabel = fromDate || toDate
    ? `${fromDate || 'đầu kỳ'} → ${toDate || 'nay'}`
    : 'toàn bộ thời gian';
  const scopeLabel = effectiveScope === 'all' ? 'tất cả quán' : shops.find(c => c.id === effectiveScope)?.name ?? '';

  const handleExport = async () => {
    if (soHoaDon === 0) {
      toast({ description: 'Không có hóa đơn nào trong khoảng đã lọc.' });
      return;
    }
    setExporting(true);
    try {
      /**
       * Chi tiết từng hóa đơn CHỈ tải lúc bấm nút này.
       *
       * Màn hình không cần chúng — `/revenue/summary` đã cộng sẵn mọi con số hiện ra.
       * Nhưng tệp Excel thì cần từng dòng, nên lượt gọi nặng ngày xưa vẫn còn đây,
       * chỉ là đã dời khỏi đường mở trang sang một thao tác hiếm mà người dùng chủ
       * động chọn và sẵn sàng chờ.
       *
       * TUẦN TỰ chứ không `Promise.all`, và lần này lý do KHÔNG phải "máy chủ chạy
       * một request một lúc" (từ 14/08 nó chạy 3 worker). Lý do là bộ nhớ: gói Render
       * miễn phí có 512MB, mỗi phản hồi danh sách dài chiếm hàng trăm MB ở phía máy
       * chủ, nên bắn ba lượt cùng lúc là cách chắc chắn nhất để tiến trình bị giết.
       */
      const hoaDon: Invoice[] = [];
      const quanHong: string[] = [];
      for (const c of canTai) {
        try {
          hoaDon.push(...await invoiceService.listByShop(c.id, c.name, {
            from: fromDate || undefined,
            to: toDate || undefined,
          }));
        } catch {
          quanHong.push(c.name);
        }
      }

      if (hoaDon.length === 0) {
        throw new Error('Không tải được hóa đơn nào để xuất.');
      }
      // Xuất thiếu quán mà không nói là đưa cho người nhận một tệp trông đầy đủ
      // nhưng thiếu tiền. Nói trước, rồi vẫn xuất phần lấy được.
      if (quanHong.length > 0) {
        toast({
          description: `Thiếu hóa đơn của ${quanHong.join(' · ')} — tệp chỉ gồm các quán còn lại.`,
          variant: 'destructive',
        });
      }

      // Cột "Quán" chỉ có nghĩa khi file gộp nhiều quán; đang xem riêng một quán mà
      // vẫn xuất thì cả cột lặp lại đúng một cái tên.
      const multi = effectiveScope === 'all' && shops.length > 1;
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
        hoaDon.map(inv => [
          ...(multi ? [inv.shopName ?? ''] : []),
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
        description={shops.length > 1 ? 'Thống kê quán đang quản lý, có thể xem gộp mọi quán' : 'Thống kê doanh thu chi tiết'}
        actions={
          <button onClick={handleExport} disabled={exporting} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />{exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        }
      />

      {/* Không còn dải cảnh báo "thiếu N quán": số liệu nay về trong MỘT lượt gọi đã
          cộng sẵn, nên không tồn tại trạng thái nửa vời "vài quán xong, vài quán rớt".
          Hỏng thì rơi vào nhánh `error` ở trên, kèm nút Thử lại. */}

      <FilterBar>
        {shops.length > 1 && (
          <select
            className="input-funcafe !w-auto min-w-[170px]"
            value={effectiveScope}
            onChange={e => setScope(e.target.value)}
            aria-label="Chọn quán"
          >
            <option value="all">Tất cả quán ({shops.length})</option>
            {shops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        Đang xem <span className="font-semibold text-ink">{scopeLabel}</span> · {rangeLabel} · {soHoaDon} hóa đơn
      </p>

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Doanh thu" value={formatCurrency(revenue)} icon={DollarSign} featured hint={`${soHoaDon} hóa đơn`} />
        <StatCard label="Doanh thu hôm nay" value={formatCurrency(todayRevenue)} icon={TrendingUp} color="green" />
        <StatCard label="Trung bình/hóa đơn" value={formatCurrency(avgPerInvoice)} icon={BarChart3} color="blue" />
        {showComparison && shopRanking[0]?.revenue > 0 ? (
          <StatCard
            label="Quán dẫn đầu"
            value={shopRanking[0].name}
            icon={Trophy}
            color="yellow"
            hint={formatCurrency(shopRanking[0].revenue)}
          />
        ) : (
          <StatCard label="Tổng hóa đơn" value={soHoaDon} icon={Receipt} color="yellow" />
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
            <ShopRevenueComparison rows={shopRanking} />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
