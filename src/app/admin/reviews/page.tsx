'use client';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { reviewService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { Star, AlertCircle, Eye, EyeOff, History, RotateCcw, MessageSquareText } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/format';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge from '@/components/user/StatusBadge';
import type { Review } from '@/types';

/** Ngày dùng để lọc — cùng quy ước 'YYYY-MM-DD' với các trang doanh thu. */
const dayOf = (r: Review) => (r.createdAt ?? '').slice(0, 10);

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5" title={`${rating}/5 sao`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${cls} ${i <= rating ? 'text-gold fill-gold' : 'text-cafe-200'}`} />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4' | '3' | 'low'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<Review | null>(null);

  useEffect(() => {
    reviewService.adminList()
      .then(setReviews)
      .catch(() => { setError(true); toast({ description: 'Không thể tải đánh giá', variant: 'destructive' }); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (r: Review) => {
    try {
      await reviewService.toggleStatus(r.id);
      const next = r.status === 'visible' ? 'hidden' : 'visible';
      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, status: next } : x));
      setDetail(d => (d && d.id === r.id ? { ...d, status: next } : d));
      toast({ description: next === 'hidden' ? 'Đã ẩn đánh giá khỏi trang giới thiệu' : 'Đã hiện lại đánh giá' });
    } catch {
      toast({ description: 'Thao tác thất bại', variant: 'destructive' });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (ratingFilter === 'low' ? r.rating > 2 : ratingFilter !== 'all' && r.rating !== Number(ratingFilter)) return false;
      const d = dayOf(r);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      if (!q) return true;
      return (
        (r.userName?.toLowerCase().includes(q) ?? false) ||
        (r.userEmail?.toLowerCase().includes(q) ?? false) ||
        (r.cafeName?.toLowerCase().includes(q) ?? false) ||
        (r.title?.toLowerCase().includes(q) ?? false) ||
        (r.comment?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [reviews, search, statusFilter, ratingFilter, fromDate, toDate]);

  const hasFilter = !!(search || fromDate || toDate || statusFilter !== 'all' || ratingFilter !== 'all');
  const clearFilters = () => {
    setSearch(''); setFromDate(''); setToDate('');
    setStatusFilter('all'); setRatingFilter('all');
  };

  // Chỉ số tính trên tập ĐANG LỌC: đổi khoảng ngày là thấy ngay điểm trung bình
  // của khoảng đó, chứ không phải con số muôn thuở của cả hệ thống.
  const avg = filtered.length > 0
    ? (filtered.reduce((s, r) => s + r.rating, 0) / filtered.length).toFixed(1)
    : '—';
  const visibleCount = filtered.filter(r => r.status === 'visible').length;
  const editedCount = filtered.filter(r => (r.history?.length ?? 0) > 0).length;

  return (
    <div>
      <PageHeader
        title="Quản lý đánh giá FunCafe"
        description={`${reviews.length} đánh giá từ chủ quán · điểm trung bình ${
          reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—'
        }/5`}
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm người dùng, quán hoặc nội dung..." />
        <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t); }} />
        <select
          className="input-funcafe !w-auto min-w-[140px]"
          value={ratingFilter}
          onChange={e => setRatingFilter(e.target.value as typeof ratingFilter)}
          aria-label="Lọc theo số sao"
        >
          <option value="all">Mọi mức sao</option>
          <option value="5">5 sao</option>
          <option value="4">4 sao</option>
          <option value="3">3 sao</option>
          <option value="low">Dưới 3 sao</option>
        </select>
        <select
          className="input-funcafe !w-auto min-w-[140px]"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          aria-label="Lọc theo trạng thái"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="visible">Đang hiển thị</option>
          <option value="hidden">Đang ẩn</option>
        </select>
        {hasFilter && (
          <button onClick={clearFilters} className="btn-secondary">
            <RotateCcw className="w-3.5 h-3.5" />Xóa lọc
          </button>
        )}
      </FilterBar>

      {!loading && !error && (
        <p className="text-sm text-cafe-500 -mt-2 mb-5">
          Đang xem <span className="font-semibold text-ink">{filtered.length}</span> đánh giá
          {' · '}trung bình <span className="font-semibold text-ink">{avg}</span>/5
          {' · '}{visibleCount} đang hiển thị
          {editedCount > 0 && <> · {editedCount} đã từng sửa</>}
        </p>
      )}

      {loading && <LoadingSkeleton variant="table" rows={8} cols={6} />}
      {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải đánh giá.</span></div>}

      {!loading && !error && filtered.length === 0 && (
        hasFilter
          ? <EmptyState title="Không có đánh giá nào khớp bộ lọc" description="Thử nới khoảng ngày hoặc xóa bớt điều kiện lọc." />
          : <EmptyState title="Chưa có đánh giá nào" description="Khi chủ quán gửi đánh giá FunCafe, chúng sẽ hiển thị ở đây." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-line overflow-x-auto shadow-soft">
          <table className="w-full text-sm min-w-[880px]">
            <thead className="bg-sand border-b border-line">
              <tr>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Người dùng</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Quán</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Đánh giá</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Nội dung</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Trạng thái</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Thời gian</th>
                <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {filtered.map(r => {
                const edits = r.history?.length ?? 0;
                return (
                  <tr key={r.id} className="hover:bg-sand/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="block text-ink font-semibold">{r.userName || '—'}</span>
                      {r.userEmail && <span className="block text-xs text-cafe-400">{r.userEmail}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-cafe-600">{r.cafeName || '—'}</span>
                      {r.packageName && <span className="block text-xs text-cafe-400">{r.packageName}</span>}
                    </td>
                    <td className="px-4 py-3"><StarRating rating={r.rating} /></td>
                    <td className="px-4 py-3 max-w-sm">
                      {r.title && <span className="block font-medium text-ink truncate">{r.title}</span>}
                      <span className="block text-cafe-600 line-clamp-2">{r.comment || (r.title ? '' : '—')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={r.status === 'visible' ? 'success' : 'neutral'}>
                        {r.status === 'visible' ? 'Hiển thị' : 'Ẩn'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="block text-cafe-400">{formatDate(r.createdAt)}</span>
                      {edits > 0 && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-gold-deep font-medium">
                          <History className="w-3 h-3" />đã sửa {edits} lần
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setDetail(r)}
                          title="Xem chi tiết đánh giá"
                          aria-label={`Xem chi tiết đánh giá của ${r.userName || 'người dùng'}`}
                          className="p-2 rounded-lg text-cafe-500 hover:text-bean hover:bg-sand transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(r)}
                          title={r.status === 'visible' ? 'Ẩn đánh giá' : 'Hiện đánh giá'}
                          aria-label={r.status === 'visible' ? 'Ẩn đánh giá' : 'Hiện đánh giá'}
                          className={`p-2 rounded-lg transition-colors ${r.status === 'visible' ? 'text-cafe-400 hover:text-red-600 hover:bg-red-50' : 'text-cafe-400 hover:text-pine hover:bg-pine/12'}`}
                        >
                          {r.status === 'visible' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Chi tiết đánh giá" size="xl">
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StarRating rating={detail.rating} size="lg" />
              <span className="text-lg font-bold text-ink">{detail.rating}/5</span>
              <StatusBadge tone={detail.status === 'visible' ? 'success' : 'neutral'}>
                {detail.status === 'visible' ? 'Đang hiển thị trên trang giới thiệu' : 'Đang ẩn'}
              </StatusBadge>
            </div>

            <dl className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'Người đánh giá', value: detail.userName || '—' },
                { label: 'Email', value: detail.userEmail || '—' },
                { label: 'Quán', value: detail.cafeName || '—' },
                { label: 'Gói lúc đánh giá', value: detail.packageName || '—' },
                { label: 'Gửi lúc', value: formatDateTime(detail.createdAt) },
                {
                  label: 'Sửa lần cuối',
                  value: (detail.history?.length ?? 0) > 0 && detail.updatedAt
                    ? formatDateTime(detail.updatedAt)
                    : 'Chưa sửa lần nào',
                },
              ].map(row => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-xs text-cafe-500 mb-0.5">{row.label}</dt>
                  <dd className="text-ink font-medium break-words">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="label-funcafe">Nội dung hiện tại</p>
              <div className="rounded-xl border border-line bg-sand/60 p-4">
                {detail.title && <p className="font-semibold text-ink mb-1.5">{detail.title}</p>}
                <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                  {detail.comment || <span className="italic text-cafe-400">Chủ quán chỉ chấm sao, không viết nhận xét.</span>}
                </p>
              </div>
            </div>

            {(detail.history?.length ?? 0) > 0 && (
              <div>
                <p className="label-funcafe flex items-center gap-1.5">
                  <History className="w-4 h-4 text-cafe-400" />
                  Các bản trước ({detail.history!.length})
                </p>
                {/* Mốc thời gian: bản gần đây nhất lên trên, nhạt dần để phân biệt
                    rõ với nội dung hiện hành ở khối trên. */}
                <ol className="relative border-l border-line ml-1.5 space-y-4 pt-1">
                  {detail.history!.map((h, i) => (
                    <li key={i} className="ml-5">
                      <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-cafe-300 border-2 border-white" />
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <StarRating rating={h.rating} />
                        <span className="text-xs text-cafe-500">
                          {h.writtenAt ? `viết ${formatDateTime(h.writtenAt)}` : 'không rõ thời điểm viết'}
                          {h.replacedAt ? ` · thay lúc ${formatDateTime(h.replacedAt)}` : ''}
                        </span>
                      </div>
                      <div className="rounded-xl border border-line/70 bg-paper/70 px-3.5 py-2.5">
                        {h.title && <p className="text-sm font-medium text-ink/80 mb-1">{h.title}</p>}
                        <p className="text-sm text-ink/70 whitespace-pre-wrap leading-relaxed">
                          {h.comment || <span className="italic text-cafe-400">Không có nhận xét.</span>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {(detail.history?.length ?? 0) === 0 && (
              <p className="flex items-center gap-2 text-sm text-cafe-500">
                <MessageSquareText className="w-4 h-4 shrink-0" />
                Đánh giá này chưa được sửa lần nào — hoặc được gửi trước khi hệ thống bắt đầu lưu lịch sử.
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setDetail(null)} className="btn-secondary">Đóng</button>
              <button onClick={() => handleToggle(detail)} className="btn-primary">
                {detail.status === 'visible'
                  ? <><EyeOff className="w-4 h-4" />Ẩn khỏi trang giới thiệu</>
                  : <><Eye className="w-4 h-4" />Hiện trên trang giới thiệu</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
