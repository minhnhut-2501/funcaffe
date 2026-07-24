'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { reviewService } from '@/services';
import type { PublicReview } from '@/types';
import Avatar from './Avatar';

type Item = {
  key: string;
  rating: number;
  title?: string;
  text: string;
  name: string;
  cafe?: string;
  avatar?: string;
};

const sample: Item[] = [
  { key: 's1', rating: 5, text: 'Giao diện dễ dùng, nhân viên mới làm quen chỉ trong buổi đầu. Order nhanh hơn hẳn lúc ghi giấy.', name: 'Trần Minh Hùng', cafe: 'Cafe Góc Nhỏ' },
  { key: 's2', rating: 5, text: 'Quản lý bàn và hóa đơn rõ ràng, cuối ngày không phải ngồi cộng tay nữa.', name: 'Nguyễn Thị Lan', cafe: 'Trà sữa MiMi' },
  { key: 's3', rating: 4, text: 'Thêm size với topping cho từng món rất tiện, khách đổi món cũng không bị nhầm.', name: 'Lê Đăng Khoa', cafe: 'Cafe Sân Vườn' },
  { key: 's4', rating: 5, text: 'Báo cáo doanh thu theo ngày giúp mình biết món nào nên giữ, món nào nên bỏ.', name: 'Phạm Thu Hà', cafe: 'The Brew House' },
  { key: 's5', rating: 5, text: 'Một màn hình thấy hết bàn trống bàn bận, giờ cao điểm đỡ rối hẳn.', name: 'Võ Quốc Bảo', cafe: 'Nắng Coffee' },
];

export default function ReviewsCarousel() {
  const [items, setItems] = useState<Item[]>(sample);
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    reviewService.getPublicReviews()
      .then((rs: PublicReview[]) => {
        const mapped = rs
          .filter(r => r.comment)
          .slice(0, 12)
          .map((r): Item => ({
            key: r.id,
            rating: r.rating,
            title: r.title,
            text: r.comment as string,
            name: r.userName || 'Chủ quán',
            cafe: r.cafeName,
          }));
        if (mapped.length >= 3) setItems(mapped);
      })
      .catch(() => {});
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
            className="snap-start shrink-0 w-[85%] sm:w-[360px] bg-white rounded-2xl border border-line p-6 flex flex-col"
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
                {r.cafe && <p className="text-ink/70 text-xs truncate">{r.cafe}</p>}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-5">
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
