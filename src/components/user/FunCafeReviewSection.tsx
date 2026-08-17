'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { reviewService } from '@/services';
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
  const { user, cafes } = useAuth();
  const { toast } = useToast();
  const sub = user?.subscription;
  const pkg = sub?.packageType ?? 'none';

  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviewForm, setReviewForm] = useState<{ rating: number; title: string; comment: string }>({ rating: 5, title: '', comment: '' });
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [reviewReady, setReviewReady] = useState(false); // đã có quán -> mới gọi được API review

  // Gọi VÔ ĐIỀU KIỆN, kể cả khi mine === null: null nghĩa là chưa viết đánh giá nào,
  // và trạng thái đó phải xóa được nội dung cũ đang nằm trên form.
  const applyMine = (mine: Review | null) => {
    setMyReview(mine);
    setReviewForm({
      rating: mine?.rating ?? 5,
      title: mine?.title ?? '',
      comment: mine?.comment ?? '',
    });
  };

  // Không phụ thuộc activeCafeId: đánh giá là về FunCafe, mỗi tài khoản một cái,
  // nên đổi quán không làm đổi đánh giá. Trước đây hook này gọi listByCafe() theo
  // quán đang chọn và CHỈ setMyReview khi tìm thấy — nên chuyển sang quán chưa
  // đánh giá thì form vẫn giữ nội dung của quán trước và nút vẫn ghi "Cập nhật".
  // Danh sách quán đã có sẵn trong AuthContext. Trước đây chỗ này gọi thêm
  // `GET /cafes` chỉ để đếm, và nuốt luôn lỗi: mạng trục trặc là khối đánh giá
  // lặng lẽ biến mất, không một dòng thông báo nào.
  useEffect(() => {
    if (!user || cafes.length === 0) return;
    setReviewReady(true);
    reviewService.mine().then(applyMine).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, cafes.length]);

  // Chặn ngay ở đây thay vì để máy chủ trả 422: người dùng biết còn thiếu gì TRƯỚC khi
  // bấm, chứ không phải sau một vòng đi về mạng.
  const title = reviewForm.title.trim();
  const comment = reviewForm.comment.trim();
  const dayDu = reviewForm.rating >= 1 && title !== '' && comment !== '';

  const handleSubmit = async () => {
    if (!dayDu) return;
    setSubmitting(true);
    try {
      await reviewService.create({
        rating: reviewForm.rating,
        title,
        comment,
      });
      toast({ description: myReview ? 'Đã cập nhật đánh giá của bạn. Cảm ơn bạn!' : 'Đã gửi đánh giá. Cảm ơn bạn!' });
      applyMine(await reviewService.mine().catch(() => null));
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
          <label className="label-funcafe">Tiêu đề</label>
          <input className="input-funcafe" placeholder="VD: Quản lý quán nhàn hơn hẳn"
            value={reviewForm.title} maxLength={255}
            onChange={e => setReviewForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="label-funcafe">Nội dung</label>
          <textarea className="input-funcafe min-h-[80px]" placeholder="Bạn thích/chưa thích điều gì ở FunCafe?"
            value={reviewForm.comment} maxLength={2000}
            onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleSubmit} disabled={submitting || !dayDu} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Đang gửi...' : myReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
          </button>
          {/* Nút mờ đi mà không nói vì sao là một câu đố. Chỉ hiện khi thật sự còn thiếu. */}
          {!dayDu && (
            <span className="text-sm text-ink/60">Nhập cả tiêu đề và nội dung để gửi được đánh giá.</span>
          )}
        </div>
      </div>
    );
  };

  return (
    // id: đích của liên kết "Viết đánh giá" ở trang chủ khi chưa có đánh giá nào.
    // scroll-mt-24 để header sticky không che mất tiêu đề khi nhảy tới neo.
    <div id="danh-gia" className="scroll-mt-24 rounded-2xl bg-white border border-line p-6 sm:p-8 shadow-sm">
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
