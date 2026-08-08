'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Số dòng mỗi trang dùng chung cho mọi bảng. */
export const PER_PAGE = 10;

/**
 * Cắt trang cho một mảng đã lọc sẵn.
 *
 * THỨ TỰ BẮT BUỘC ở nơi gọi: lọc → tìm kiếm → RỒI MỚI truyền vào đây. Cắt trang
 * trước khi lọc là lọc trong phạm vi một trang, cho ra kết quả sai.
 *
 * Hook tự kéo trang hiện tại về trong khoảng hợp lệ, xử lý luôn hai tình huống
 * hay để lại màn hình trắng: đang ở trang cuối mà gõ từ khóa làm danh sách ngắn
 * lại, và xóa/ẩn dòng cuối cùng của trang cuối.
 */
export function usePagination<T>(rows: T[], perPage: number = PER_PAGE) {
  const [page, setPage] = useState(1);
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  // Trang có thể còn vượt khoảng ở ngay lượt vẽ này (effect chạy sau khi vẽ xong),
  // nên phải kẹp lại tại chỗ, nếu không sẽ chớp một khung hình rỗng.
  const safePage = Math.min(page, lastPage);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * perPage, safePage * perPage),
    [rows, safePage, perPage],
  );

  return { page: safePage, setPage, lastPage, pageRows, total: rows.length, perPage };
}

interface PaginationProps {
  page: number;
  lastPage: number;
  total: number;
  perPage?: number;
  onChange: (page: number) => void;
  /** Tên đơn vị hiển thị trong dòng đếm, mặc định "mục". */
  unit?: string;
  className?: string;
}

/** Dãy số trang, rút gọn bằng dấu … khi nhiều trang: 1 … 4 5 6 … 12 */
function pageNumbers(page: number, lastPage: number): (number | '…')[] {
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(lastPage - 1, page + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < lastPage - 1) out.push('…');
  out.push(lastPage);
  return out;
}

/**
 * Thanh phân trang dùng chung.
 *
 * Chỉ một trang thì không vẽ gì — thanh "Trang 1/1" là nhiễu chứ không phải thông tin.
 */
export default function Pagination({
  page, lastPage, total, perPage = PER_PAGE, onChange, unit = 'mục', className = '',
}: PaginationProps) {
  if (lastPage <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const go = (p: number) => onChange(Math.min(lastPage, Math.max(1, p)));

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mt-4 ${className}`}>
      <p className="text-sm text-cafe-500">
        Hiển thị <b className="text-ink font-semibold">{from}–{to}</b> trong <b className="text-ink font-semibold">{total}</b> {unit}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => go(page - 1)}
          disabled={page === 1}
          aria-label="Trang trước"
          className="p-2 rounded-lg border border-line text-cafe-500 hover:text-bean hover:bg-sand disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pageNumbers(page, lastPage).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1.5 text-cafe-400 select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`min-w-[2.25rem] px-2.5 py-2 text-sm rounded-lg border transition-colors ${
                p === page
                  ? 'border-bean bg-bean text-white font-semibold'
                  : 'border-line text-cafe-600 hover:text-bean hover:bg-sand font-medium'
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => go(page + 1)}
          disabled={page === lastPage}
          aria-label="Trang sau"
          className="p-2 rounded-lg border border-line text-cafe-500 hover:text-bean hover:bg-sand disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
