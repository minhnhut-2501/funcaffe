'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Star, ChevronLeft, ChevronRight, Quote, MessageSquarePlus } from 'lucide-react';
import { reviewService } from '@/services';
import type { PublicReview } from '@/types';
import Avatar from './Avatar';

type Item = {
  key: string;
  rating: number;
  title?: string;
  text: string;
  name: string;
  shop?: string;
  avatar?: string;
};

/**
 * Đánh giá thật, hoặc không có gì cả.
 *
 * Chỗ này từng có mảng `sample` gồm 5 lời khen bịa (tên người + tên quán tự nghĩ
 * ra) làm giá trị khởi tạo, và chỉ thay bằng dữ liệu thật khi API trả về từ 3 bản
 * ghi trở lên. Hệ quả: quán có 1-2 đánh giá thật thì trang chủ hiện 5 cái giả và
 * GIẤU luôn cái thật; admin thì trống trơn. Nay `null` = đang tải, `[]` = chưa ai
 * đánh giá, và lỗi mạng cũng rơi vào `[]` — không có đường nào dẫn tới dữ liệu bịa.
 */
export default function ReviewsCarousel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    reviewService.getPublicReviews()
      .then((rs: PublicReview[]) => {
        setItems(rs
          .filter(r => r.comment)
          .slice(0, 12)
          .map((r): Item => ({
            key: r.id,
            rating: r.rating,
            title: r.title,
            text: r.comment as string,
            name: r.userName || 'Chủ quán',
            shop: r.shopName,
            avatar: r.avatarUrl,
          })));
      })
      .catch(() => setItems([]));
  }, []);

  const updateEdges = () => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  useEffect(() => {
    updateEdges();
  }, [items]);

  const scrollByCards = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const amount = card ? card.offsetWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  // Kéo chuột để lướt (desktop). Trên cảm ứng đã có swipe gốc của trình duyệt.
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el || e.pointerType === 'touch') return;
    drag.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  };
  const endDrag = () => { drag.current.active = false; };

  if (items === null) {
    return (
      <div className="flex gap-5 overflow-hidden" aria-hidden>
        {[0, 1, 2].map(i => (
          // Cùng bề ngang và bề cao với thẻ thật để nội dung dưới không nhảy khi tải xong.
          <div key={i} className="shrink-0 w-[85%] sm:w-[360px] h-64 rounded-2xl border border-line bg-white p-6 skeleton-sweep">
            <div className="w-7 h-7 rounded bg-cafe-100 mb-3" />
            <div className="h-3 w-24 rounded bg-cafe-100 mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-cafe-50" />
              <div className="h-3 w-full rounded bg-cafe-50" />
              <div className="h-3 w-3/5 rounded bg-cafe-50" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-line p-8 text-center">
        <span className="w-12 h-12 rounded-xl bg-bean-tint text-bean grid place-items-center mx-auto mb-4">
          <MessageSquarePlus className="w-6 h-6" />
        </span>
        <p className="font-semibold text-ink mb-1.5">Chưa có đánh giá nào</p>
        <p className="text-sm text-ink/70 leading-relaxed mb-5">
          Bạn đang dùng FunCafe cho quán của mình? Hãy là người đầu tiên chia sẻ trải nghiệm.
        </p>
        <Link href="/support#danh-gia" className="btn-cafe-outline inline-flex py-2.5 px-5 text-sm">
          Viết đánh giá
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={updateEdges}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className="no-scrollbar flex gap-5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 cursor-grab active:cursor-grabbing select-none"
      >
        {items.map((r) => (
          <article
            key={r.key}
            data-card
            // `lift`: băng đánh giá là phần social proof ở cuối trang chủ — thẻ nhích
            // lên khi rê chuột báo cho người xem biết dải này kéo ngang được.
            className="lift snap-start shrink-0 w-[85%] sm:w-[360px] bg-white rounded-2xl border border-line p-6 flex flex-col"
          >
            <Quote className="w-7 h-7 text-gold mb-3" />
            <div className="flex gap-0.5 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-4 h-4 ${s <= r.rating ? 'fill-gold text-gold' : 'text-line'}`} />
              ))}
            </div>
            {r.title && <p className="font-semibold text-ink mb-1">{r.title}</p>}
            <p className="text-ink/70 text-sm leading-relaxed flex-1">{r.text}</p>
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-line">
              <Avatar name={r.name} src={r.avatar} size={44} />
              <div className="min-w-0">
                <p className="font-medium text-ink text-sm truncate">{r.name}</p>
                {r.shop && <p className="text-ink/70 text-xs truncate">{r.shop}</p>}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Mọi thẻ đã nằm vừa khung (1-2 đánh giá) thì hai nút chỉ còn là hai vòng tròn
          mờ bấm không được — ẩn hẳn thay vì để chúng vô hiệu hóa. */}
      <div className={`justify-end gap-2 mt-5 ${atStart && atEnd ? 'hidden' : 'flex'}`}>
        <button
          onClick={() => scrollByCards(-1)}
          disabled={atStart}
          aria-label="Xem review trước"
          className="w-10 h-10 rounded-full border border-line bg-white flex items-center justify-center text-bean transition-colors hover:bg-paper disabled:opacity-35 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => scrollByCards(1)}
          disabled={atEnd}
          aria-label="Xem review tiếp theo"
          className="w-10 h-10 rounded-full border border-line bg-white flex items-center justify-center text-bean transition-colors hover:bg-paper disabled:opacity-35 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
