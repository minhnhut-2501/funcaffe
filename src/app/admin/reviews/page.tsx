'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { reviewService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { Star, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { FilterBar, SearchInput } from '@/components/user/FilterBar';
import StatusBadge from '@/components/user/StatusBadge';
import type { Review } from '@/types';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-4 h-4 ${i <= rating ? 'text-gold fill-gold' : 'text-cafe-200'}`} />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    reviewService.adminList()
      .then(setReviews)
      .catch(() => { setError(true); toast({ description: 'Không thể tải đánh giá', variant: 'destructive' }); })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (r: Review) => {
    try {
      await reviewService.toggleStatus(r.id);
      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, status: x.status === 'visible' ? 'hidden' : 'visible' } : x));
      toast({ description: r.status === 'visible' ? 'Đã ẩn đánh giá' : 'Đã hiện đánh giá' });
    } catch {
      toast({ description: 'Thao tác thất bại', variant: 'destructive' });
    }
  };

  const filtered = reviews.filter(r =>
    (r.userName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    (r.cafeName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    (r.comment?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div>
      <PageHeader title="Quản lý đánh giá FunCafe" description={`${reviews.length} đánh giá từ người dùng`} />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm người dùng, quán hoặc nội dung..." />
      </FilterBar>

      {loading && <LoadingSkeleton variant="table" rows={8} cols={6} />}
      {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4"><AlertCircle className="w-5 h-5" /><span>Không thể tải đánh giá.</span></div>}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState title="Chưa có đánh giá nào" description="Khi người dùng gửi đánh giá FunCafe, chúng sẽ hiển thị ở đây." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-line overflow-x-auto shadow-soft">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-sand border-b border-line">
              <tr>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Người dùng</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Quán</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Đánh giá</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Tiêu đề</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Nội dung</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Trạng thái</th>
                <th className="text-left px-4 py-3 text-cafe-600 font-semibold">Ngày tạo</th>
                <th className="text-right px-4 py-3 text-cafe-600 font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-sand/50 transition-colors">
                  <td className="px-4 py-3 text-ink font-semibold">{r.userName || '—'}</td>
                  <td className="px-4 py-3 text-cafe-600">{r.cafeName ?? '—'}</td>
                  <td className="px-4 py-3"><StarRating rating={r.rating} /></td>
                  <td className="px-4 py-3 text-cafe-600 max-w-xs truncate">{r.title ?? '—'}</td>
                  <td className="px-4 py-3 text-cafe-600 max-w-xs truncate">{r.comment ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={r.status === 'visible' ? 'success' : 'neutral'}>
                      {r.status === 'visible' ? 'Hiển thị' : 'Ẩn'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-cafe-400 text-xs">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggle(r)}
                      title={r.status === 'visible' ? 'Ẩn đánh giá' : 'Hiện đánh giá'}
                      className={`p-2 rounded-lg transition-colors ${r.status === 'visible' ? 'text-cafe-400 hover:text-red-600 hover:bg-red-50' : 'text-cafe-400 hover:text-pine hover:bg-pine/12'}`}
                    >
                      {r.status === 'visible' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
