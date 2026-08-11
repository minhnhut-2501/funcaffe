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
}

export interface RevenueOverview {
  total: number;
  today: number;
  thisMonth: number;
  revenueByMonth: { month: string; revenue: number }[];
  cafes: CafeRevenueRow[];
}

export const revenueService = {
  overview: async (): Promise<RevenueOverview> => {
    const raw = await api.get<any>('/revenue/overview');
    return {
      total: raw.total ?? 0,
      today: raw.today ?? 0,
      thisMonth: raw.this_month ?? 0,
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
      })),
    };
  },
};
