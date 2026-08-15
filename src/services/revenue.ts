/** Doanh thu tổng hợp nhiều quán. */
import { api } from '@/lib/api-client';

// Tổng doanh thu gộp tất cả quán của user (đa quán)
export interface CafeRevenueRow {
  cafeId: string;
  cafeName: string;
  status: string;
  packageName: string | null;
  hasPackage: boolean;
  total: number;
  today: number;
  month: number;
  /** SỐ hóa đơn đã thanh toán của quán (toàn bộ thời gian). */
  count: number;
}

export interface RevenueOverview {
  total: number;
  today: number;
  thisMonth: number;
  /** Tổng số hóa đơn gộp mọi quán. */
  count: number;
  revenueByMonth: { month: string; revenue: number }[];
  cafes: CafeRevenueRow[];
}

/** Một mốc trên biểu đồ: 'YYYY-MM-DD' (hoặc 'YYYY-MM') kèm số tiền. */
export interface RevenueBucket {
  key: string;
  value: number;
}

export interface RevenueSummary {
  total: number;
  count: number;
  /** Doanh thu theo NGÀY, đã sắp xếp tăng dần. Gom sang tháng/năm thì cắt bớt khóa. */
  byDay: RevenueBucket[];
  byMonth: RevenueBucket[];
  topItems: { name: string; count: number; revenue: number }[];
  cafes: { cafeId: string; cafeName: string; total: number; count: number }[];
}

function docMoc(raw: unknown): RevenueBucket[] {
  return Object.entries((raw ?? {}) as Record<string, unknown>)
    .map(([key, value]) => ({ key, value: Number(value) || 0 }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export const revenueService = {
  /**
   * Số liệu trang Doanh thu, ĐÃ CỘNG SẴN ở máy chủ.
   *
   * Thay cho việc tải toàn bộ hóa đơn của từng quán rồi cộng trong trình duyệt: một
   * request trả vài chục kilobyte thay vì một request MỖI QUÁN trả vài megabyte, và
   * chi phí thôi lớn dần theo số hóa đơn tích lũy.
   *
   * KHÔNG có danh sách hóa đơn trong kết quả — nút Xuất Excel cần chi tiết thì gọi
   * `invoiceService.listByCafe` lúc bấm.
   */
  summary: async (params: { from?: string; to?: string; cafeId?: string } = {}): Promise<RevenueSummary> => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    // 'all' là quy ước của giao diện, không phải mã quán — vắng mặt tham số mới là
    // "gộp mọi quán" đối với máy chủ.
    if (params.cafeId && params.cafeId !== 'all') qs.set('cafe_id', params.cafeId);

    const raw = await api.get<any>(`/revenue/summary${qs.toString() ? `?${qs}` : ''}`);
    return {
      total: raw.total ?? 0,
      count: raw.count ?? 0,
      byDay: docMoc(raw.by_day),
      byMonth: docMoc(raw.by_month),
      topItems: (raw.top_items ?? []).map((r: any) => ({
        name: r.name ?? 'Khác',
        count: r.count ?? 0,
        revenue: r.revenue ?? 0,
      })),
      cafes: (raw.cafes ?? []).map((c: any) => ({
        cafeId: c.cafe_id,
        cafeName: c.cafe_name ?? '',
        total: c.total ?? 0,
        count: c.count ?? 0,
      })),
    };
  },

  overview: async (): Promise<RevenueOverview> => {
    const raw = await api.get<any>('/revenue/overview');
    return {
      total: raw.total ?? 0,
      today: raw.today ?? 0,
      thisMonth: raw.this_month ?? 0,
      count: raw.count ?? 0,
      revenueByMonth: Object.entries(raw.revenue_by_month ?? {}).map(([month, revenue]) => ({
        month, revenue: Number(revenue) || 0,
      })),
      cafes: (raw.cafes ?? []).map((c: any) => ({
        cafeId: c.cafe_id,
        cafeName: c.cafe_name,
        status: c.status,
        packageName: c.package_name ?? null,
        hasPackage: !!c.has_package,
        total: c.total ?? 0,
        today: c.today ?? 0,
        month: c.month ?? 0,
        count: c.count ?? 0,
      })),
    };
  },
};
