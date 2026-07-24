'use client';
import { useState, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import LockedBox from '@/components/ui/LockedBox';
import StatCard from '@/components/ui/StatCard';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/user/SectionCard';
import RevenueAiInsights from '@/components/user/RevenueAiInsights';
import { FilterBar } from '@/components/user/FilterBar';
import { useAuth } from '@/context/AuthContext';
import { invoiceService } from '@/services';
import { useApi } from '@/hooks/use-api';
import { canViewRevenue } from '@/lib/permission';
import { formatCurrency } from '@/lib/format';
import { Download, TrendingUp, Receipt, DollarSign, BarChart3, AlertCircle } from 'lucide-react';
import { downloadCSV } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Invoice } from '@/types';

function groupByMonth(invoices: Invoice[]): { month: string; revenue: number }[] {
  const groups: Record<string, number> = {};
  (invoices ?? []).forEach(inv => {
    const date = inv.paidAt || inv.createdAt;
    const m = date.slice(0, 7);
    groups[m] = (groups[m] ?? 0) + inv.totalAmount;
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
    month: `T${k.slice(5)}`, revenue: v,
  }));
}

// BUG-20 FIX: Thêm groupByDay và groupByYear
function groupByDay(invoices: Invoice[]): { month: string; revenue: number }[] {
  const groups: Record<string, number> = {};
  (invoices ?? []).forEach(inv => {
    const date = inv.paidAt || inv.createdAt;
    const d = date.slice(0, 10);
    groups[d] = (groups[d] ?? 0) + inv.totalAmount;
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
    month: k.slice(5), revenue: v,
  }));
}

function groupByYear(invoices: Invoice[]): { month: string; revenue: number }[] {
  const groups: Record<string, number> = {};
  (invoices ?? []).forEach(inv => {
    const date = inv.paidAt || inv.createdAt;
    const y = date.slice(0, 4);
    groups[y] = (groups[y] ?? 0) + inv.totalAmount;
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
    month: k, revenue: v,
  }));
}

function computeTopItems(invoices: Invoice[]): { name: string; count: number; revenue: number }[] {
  const map: Record<string, { name: string; count: number; revenue: number }> = {};
  (invoices ?? []).forEach(inv => {
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

const monthNames = ['', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
const today = new Date();
// Mốc ngày theo giờ địa phương (tránh lệch ngày do UTC lúc gần nửa đêm)
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const thisMonth = today.getMonth() + 1;

export default function RevenuePage() {
  const { user } = useAuth();
  const { data: rawInvoices, loading, error } = useApi(() => invoiceService.list());
  // C4: hóa đơn ĐÃ HOÀN TIỀN bị loại khỏi mọi thống kê doanh thu
  const invoices = useMemo(() => (rawInvoices ?? []).filter(i => i.status === 'paid'), [rawInvoices]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState('day');

  // Tất cả useMemo phải trước các early returns để không vi phạm Rules of Hooks
  const filteredInvoices = useMemo(() => {
    let result = invoices ?? [];
    const paidAtDate = (i: Invoice) => (i.paidAt || i.createdAt).slice(0, 10);
    if (fromDate) result = result.filter(i => paidAtDate(i) >= fromDate);
    if (toDate) result = result.filter(i => paidAtDate(i) <= toDate);
    return result;
  }, [invoices, fromDate, toDate]);

  const totalRevenue = useMemo(() => (invoices ?? []).reduce((s, i) => s + i.totalAmount, 0), [invoices]);
  const todayRevenue = useMemo(() => (invoices ?? []).filter(i => (i.paidAt || i.createdAt).startsWith(todayStr)).reduce((s, i) => s + i.totalAmount, 0), [invoices]);
  const monthRevenue = useMemo(() => (invoices ?? []).filter(i => {
    const date = i.paidAt || i.createdAt;
    const m = date.slice(5, 7);
    return Number(m) === thisMonth && date.slice(0, 4) === String(today.getFullYear());
  }).reduce((s, i) => s + i.totalAmount, 0), [invoices]);
  const chartData = useMemo(() => {
    if (viewMode === 'day') return groupByDay(filteredInvoices);
    if (viewMode === 'year') return groupByYear(filteredInvoices);
    return groupByMonth(filteredInvoices);
  }, [filteredInvoices, viewMode]);
  const topItems = useMemo(() => computeTopItems(filteredInvoices), [filteredInvoices]);

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
      <PageHeader title="Doanh thu" description="Thống kê doanh thu chi tiết"
        actions={
          <button onClick={() => {
            const headers = ['Mã hóa đơn', 'Bàn', 'Phương thức', 'Số tiền', 'Ngày tạo'];
            const rows = (invoices ?? []).map(inv => [inv.invoiceCode, inv.tableName, inv.paymentMethod, String(inv.totalAmount), inv.createdAt]);
            downloadCSV(`doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
          }} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />Xuất Excel
          </button>
        }
      />

      {/* Tổng quan toàn cục — KHÔNG chịu ảnh hưởng của bộ lọc bên dưới */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Doanh thu hôm nay" value={formatCurrency(todayRevenue)} icon={DollarSign} featured />
        <StatCard label="Doanh thu tháng này" value={formatCurrency(monthRevenue)} icon={TrendingUp} color="green" />
        <StatCard label="Tổng hóa đơn" value={invoices?.length ?? 0} icon={Receipt} color="blue" />
        <StatCard label="Trung bình/hóa đơn" value={formatCurrency(invoices && invoices.length > 0 ? Math.round(totalRevenue / invoices.length) : 0)} icon={BarChart3} color="yellow" />
      </div>

      {/* Phân tích doanh thu bằng AI (gói Pro Max) */}
      <RevenueAiInsights />

      {/* Bộ lọc chỉ áp cho biểu đồ doanh thu & top món bán chạy bên dưới */}
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-cafe-600">
        <BarChart3 className="w-4 h-4 text-bean" />
        <span>Lọc biểu đồ &amp; top món bán chạy</span>
      </div>
      <FilterBar>
        <input type="date" className="input-funcafe !w-auto min-w-[150px]" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="Từ ngày" />
        <input type="date" className="input-funcafe !w-auto min-w-[150px]" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="Đến ngày" />
        <select className="input-funcafe !w-auto min-w-[150px]" value={viewMode} onChange={e => setViewMode(e.target.value)}>
          <option value="day">Theo ngày</option>
          <option value="month">Theo tháng</option>
          <option value="year">Theo năm</option>
        </select>
        <button onClick={() => { setFromDate(''); setToDate(''); }} className="btn-secondary">Xóa lọc</button>
      </FilterBar>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SectionCard title={`Doanh thu ${viewMode === 'day' ? 'theo ngày' : viewMode === 'year' ? 'theo năm' : 'theo tháng'}`} icon={BarChart3}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
              <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} labelStyle={{ color: '#1F2933', fontWeight: 600 }} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 12px 30px -16px rgba(15,23,42,.3)' }} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
              <Bar dataKey="revenue" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Top 5 món bán chạy" icon={TrendingUp}>
          <div className="space-y-3.5">
            {topItems.length === 0 && (
              <p className="text-sm text-cafe-400 text-center py-6">Không có dữ liệu trong khoảng đã lọc.</p>
            )}
            {topItems.map((item: { name: string; count: number; revenue: number }, idx: number) => (
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
      </div>
    </div>
  );
}
