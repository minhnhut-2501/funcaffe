'use client';

import { useEffect } from 'react';

/**
 * Đánh dấu chương đang đọc lên thanh mục lục dính của trang Tính năng.
 *
 * VÌ SAO CẦN: trang Tính năng dài sáu chương và có một thanh mục lục dính ở đầu, nhưng
 * thanh đó không hề biết người ta đang đọc tới đâu. Một thanh điều hướng luôn hiện mà
 * không bao giờ nói mình đang ở đâu thì chỉ còn là sáu cái nút — mất đứt phần việc
 * chính của nó là ĐỊNH VỊ.
 *
 * VÌ SAO KHÔNG VẼ LUÔN CẢ THANH Ở ĐÂY: trang Tính năng là Server Component, mà mấy
 * cái icon trong mục lục là component — không truyền qua ranh giới máy chủ → trình
 * duyệt được. Nên chia việc: máy chủ vẫn vẽ toàn bộ thanh (tốt cho SEO và cho lượt
 * hiện đầu tiên), phần này chỉ lật MỘT thuộc tính `data-dang-xem` trên đúng một thẻ.
 * Kiểu dáng nằm ở chỗ vẽ, dưới dạng biến thể `data-[dang-xem=true]:`.
 *
 * Dải nhận diện `-25% / -65%`: chương nào cắt qua vạch nằm khoảng một phần tư từ đỉnh
 * màn hình xuống thì tính là đang đọc. Lấy đúng đỉnh màn hình là sai, vì chỗ đó đang
 * bị chính thanh mục lục dính che.
 */
export default function TheoDoiChuong({ ids, navId }: { ids: string[]; navId: string }) {
  useEffect(() => {
    const nav = document.getElementById(navId);
    if (!nav) return;
    const moc = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (moc.length === 0) return;

    const itChuyenDong = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dangGiao = new Set<string>();
    let dangXem = '';

    const capNhat = () => {
      // Nhiều chương cùng cắt qua dải thì lấy chương ĐẦU theo thứ tự trang — người ta
      // đọc từ trên xuống, chương trên là chương đang đọc dở.
      const chon = ids.find((id) => dangGiao.has(id)) ?? '';
      if (chon === dangXem) return;
      dangXem = chon;

      for (const id of ids) {
        const a = nav.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`);
        if (!a) continue;
        if (id === chon) {
          a.setAttribute('data-dang-xem', 'true');
          // Thanh mục lục cuộn ngang trên điện thoại: chương đang đọc phải tự trôi vào
          // tầm mắt, nếu không thì từ chương 4 trở đi dấu hiệu nằm ngoài màn hình và
          // coi như không tồn tại. `block: 'nearest'` để tuyệt đối không kéo trang
          // nhích theo chiều dọc — đó sẽ là cuộn tự động chống lại người dùng.
          a.scrollIntoView({
            inline: 'center',
            block: 'nearest',
            behavior: itChuyenDong ? 'auto' : 'smooth',
          });
        } else {
          a.removeAttribute('data-dang-xem');
        }
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) dangGiao.add(e.target.id);
          else dangGiao.delete(e.target.id);
        }
        capNhat();
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 },
    );
    moc.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids, navId]);

  return null;
}
