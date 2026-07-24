'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { reviewService, hasCafe } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { isSubscriptionExpired } from '@/lib/permission';
import type { Review } from '@/types';

/**
 * Khối "Đánh giá FunCafe" của chủ quán — tách khỏi trang gói (không liên quan
 * tới việc mua gói) và đặt ở Trung tâm hỗ trợ. Mỗi chủ quán 1 đánh giá; gửi lại
 * = cập nhật. Yêu cầu đăng nhập + có quán + gói còn hiệu lực (khớp middleware
 * 'subscription' của route tạo đánh giá).
 */
export default function FunCafeReviewSection() {
  const { user, activeCafeId } = useAuth();
  const { toast } = useToast();
  const sub = user?.subscription;
  const pkg = sub?.packageType ?? 'none';

  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviewForm, setReviewForm] = useState<{ rating: number; title: string; comment: string }>({ rating: 5, title: '', comment: '' });
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [reviewReady, setReviewReady] = useState(false); // đã có quán -> mới gọi được API review

  useEffect(() => {
    if (!user) return;
    hasCafe().then(exists => {
      if (!exists) return;
      setReviewReady(true);
      reviewService.listByCafe().then(list => {
        const mine = list.find(r => r.userId === user?.id) ?? list[0] ?? null;
        if (mine) {
          setMyReview(mine);
          setReviewForm({ rating: mine.rating, title: mine.title ?? '', comment: mine.comment ?? '' });
        }
      }).catch(() => {});
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeCafeId]);

  const handleSubmit = async () => {
    if (reviewForm.rating < 1) return;
    setSubmitting(true);
    try {
      await reviewService.create({
        rating: reviewForm.rating,
        title: reviewForm.title.trim() || undefined,
        comment: reviewForm.comment.trim() || undefined,
      });
      toast({ description: myReview ? 'Đã cập nhật đánh giá của bạn. Cảm ơn bạn!' : 'Đã gửi đánh giá. Cảm ơn bạn!' });
      const list = await reviewService.listByCafe().catch(() => [] as Review[]);
      const mine = list.find(r => r.userId === user?.id) ?? list[0] ?? null;
      setMyReview(mine);
    } catch (err: any) {
      toast({ description: err?.message || 'Không thể gửi đánh giá, vui lòng thử lại.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const body = () => {
    if (!user) {
      return (
        <p className="text-sm text-ink/60">
          <Link href="/login" className="text-bean font-semibold hover:underline">Đăng nhập</Link> với tư cách chủ quán để gửi đánh giá về FunCafe.
        </p>
      );
    }
    if (pkg === 'none') return <p className="text-sm text-ink/60">Bạn cần kích hoạt gói dịch vụ trước khi gửi đánh giá.</p>;
    if (isSubscriptionExpired(sub)) return <p className="text-sm text-ink/60">Gói của bạn đã hết hạn — gia hạn để gửi hoặc cập nhật đánh giá.</p>;
    if (!reviewReady) return <p className="text-sm text-ink/60">Tạo quán cafe của bạn trước khi gửi đánh giá.</p>;
    return (
      <div className="space-y-3 max-w-xl">
        <div>
          <label className="label-funcafe">Mức độ hài lòng</label>
          <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button"
                onClick={() => setReviewForm(f => ({ ...f, rating: n }))}
                onMouseEnter={() => setHoverRating(n)}
                aria-label={`${n} sao`}
                className="p-0.5">
                <Star className={`w-6 h-6 transition-colors ${(hoverRating || reviewForm.rating) >= n ? 'text-gold fill-gold' : 'text-cafe-200'}`} />
              </button>
            ))}
            <span className="ml-2 text-sm text-cafe-500">{reviewForm.rating}/5</span>
          </div>
        </div>
        <div>
          <label className="label-funcafe">Tiêu đề (tuỳ chọn)</label>
          <input className="input-funcafe" placeholder="VD: Quản lý quán nhàn hơn hẳn"
            value={reviewForm.title} maxLength={255}
            onChange={e => setReviewForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="label-funcafe">Nội dung (tuỳ chọn)</label>
          <textarea className="input-funcafe min-h-[80px]" placeholder="Bạn thích/chưa thích điều gì ở FunCafe?"
            value={reviewForm.comment} maxLength={2000}
            onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} />
        </div>
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
          {submitting ? 'Đang gửi...' : myReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
        </button>
      </div>
    );
  };

  return (
    <div className="rounded-2xl bg-white border border-line p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Star className="w-5 h-5 text-gold" />
        <h3 className="text-lg font-bold text-ink">Đánh giá FunCafe</h3>
      </div>
      <p className="text-sm text-ink/60 mb-5">
        Chia sẻ trải nghiệm của bạn — đánh giá có thể được hiển thị trên trang giới thiệu của FunCafe.
        {myReview && ' Bạn đã đánh giá trước đó, gửi lại sẽ cập nhật đánh giá cũ.'}
      </p>
      {body()}
    </div>
  );
}
