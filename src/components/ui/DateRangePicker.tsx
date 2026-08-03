'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Tiện ích ngày                                                       */
/*                                                                     */
/* Toàn bộ component làm việc với chuỗi 'YYYY-MM-DD' theo GIỜ ĐỊA       */
/* PHƯƠNG. Tuyệt đối không dùng toISOString() để lấy khóa ngày: nó đổi  */
/* sang UTC nên buổi tối ở múi giờ +7 sẽ nhảy sang ngày hôm sau.        */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');

function keyOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** '2026-05-16' → '16/05/2026' */
function display(key: string) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function addDays(d: Date, n: number) {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return c;
}

/** Lùi/tiến n tháng nhưng giữ nguyên ngày; ngày 31 rơi vào tháng ngắn thì lấy ngày cuối tháng. */
function shiftMonths(d: Date, n: number) {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

/** Lưới ngày của một tháng, tuần bắt đầu từ Thứ 2; ô trống là null. */
function monthGrid(year: number, month: number): (number | null)[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

type Preset = { label: string; range: (today: Date) => [string, string] | null };

const PRESETS: Preset[] = [
  { label: 'Hôm nay', range: t => [keyOf(t), keyOf(t)] },
  { label: '7 ngày qua', range: t => [keyOf(addDays(t, -6)), keyOf(t)] },
  { label: '30 ngày qua', range: t => [keyOf(addDays(t, -29)), keyOf(t)] },
  { label: '3 tháng qua', range: t => [keyOf(shiftMonths(t, -3)), keyOf(t)] },
  { label: '12 tháng qua', range: t => [keyOf(shiftMonths(t, -12)), keyOf(t)] },
  { label: 'Tháng này', range: t => [keyOf(new Date(t.getFullYear(), t.getMonth(), 1)), keyOf(t)] },
  { label: 'Năm nay', range: t => [keyOf(new Date(t.getFullYear(), 0, 1)), keyOf(t)] },
  { label: 'Tất cả', range: () => null },
];

export interface DateRangePickerProps {
  /** Ngày bắt đầu 'YYYY-MM-DD'; chuỗi rỗng nghĩa là không giới hạn. */
  from: string;
  /** Ngày kết thúc 'YYYY-MM-DD'; chuỗi rỗng nghĩa là không giới hạn. */
  to: string;
  onChange: (from: string, to: string) => void;
  /** Nhãn hiện khi chưa chọn khoảng nào. */
  placeholder?: string;
  className?: string;
}

export default function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = 'Tất cả thời gian',
  className = '',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [hover, setHover] = useState('');
  // Tháng đang hiển thị ở lịch bên trái (lịch bên phải luôn là tháng kế tiếp).
  const [view, setView] = useState(() => new Date());
  const boxRef = useRef<HTMLDivElement>(null);

  // Bảng lịch chỉ dựng khi mở nên "hôm nay" không bao giờ được render lúc SSR —
  // tránh lệch nội dung giữa máy chủ và trình duyệt.
  const today = useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayKey = keyOf(today);

  const openPanel = () => {
    setDraftFrom(from);
    setDraftTo(to);
    setHover('');
    const anchor = from ? new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 1) : new Date();
    setView(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    setOpen(true);
  };

  // Đóng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = !from && !to
    ? placeholder
    : from && to && from !== to
      ? `${display(from)} – ${display(to)}`
      : display(from || to);

  const pickDay = (key: string) => {
    // Lượt bấm đầu chọn ngày bắt đầu, lượt sau chọn ngày kết thúc;
    // bấm ngược thứ tự thì tự đảo lại cho đúng.
    if (!draftFrom || draftTo) {
      setDraftFrom(key);
      setDraftTo('');
      return;
    }
    if (key < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(key);
    } else {
      setDraftTo(key);
    }
  };

  const applyPreset = (p: Preset) => {
    const r = p.range(today);
    if (!r) {
      setDraftFrom('');
      setDraftTo('');
      return;
    }
    setDraftFrom(r[0]);
    setDraftTo(r[1]);
    // Kéo lịch về đúng chỗ để nhìn thấy cả khoảng vừa chọn: khoảng nằm gọn trong
    // một tháng thì mở tháng đó, còn trải qua nhiều tháng thì lùi một tháng so
    // với ngày kết thúc để hai lịch phủ được phần cuối của khoảng.
    const startMonth = new Date(Number(r[0].slice(0, 4)), Number(r[0].slice(5, 7)) - 1, 1);
    const endMonth = new Date(Number(r[1].slice(0, 4)), Number(r[1].slice(5, 7)) - 1, 1);
    setView(
      startMonth.getTime() === endMonth.getTime()
        ? startMonth
        : new Date(endMonth.getFullYear(), endMonth.getMonth() - 1, 1),
    );
  };

  const activePreset = PRESETS.find(p => {
    const r = p.range(today);
    if (!r) return !draftFrom && !draftTo;
    return r[0] === draftFrom && r[1] === draftTo;
  })?.label;

  const commit = () => {
    onChange(draftFrom, draftTo || draftFrom);
    setOpen(false);
  };

  // Khoảng đang tô: khi mới chọn ngày đầu thì lấy ngày đang rê chuột làm mốc cuối.
  const rangeEnd = draftTo || (draftFrom && hover > draftFrom ? hover : draftFrom);

  const years = useMemo(() => {
    const base = today.getFullYear();
    const list: number[] = [];
    for (let y = base - 6; y <= base + 1; y++) list.push(y);
    if (!list.includes(view.getFullYear())) list.push(view.getFullYear());
    return list.sort((a, b) => a - b);
  }, [today, view]);

  const renderMonth = (offset: number) => {
    const y = view.getFullYear();
    const m = view.getMonth() + offset;
    const date = new Date(y, m, 1);
    const year = date.getFullYear();
    const month = date.getMonth();

    return (
      <div className="w-full sm:w-[17rem]">
        <div className="flex items-center justify-between gap-2 mb-3 h-9">
          {offset === 0 ? (
            <button
              type="button"
              onClick={() => setView(new Date(y, m - 1, 1))}
              aria-label="Tháng trước"
              className="p-1.5 rounded-lg text-cafe-500 hover:bg-sand hover:text-bean transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <span className="w-7 hidden sm:block" />
          )}

          {offset === 0 ? (
            // Chọn nhanh tháng/năm để không phải bấm mũi tên nhiều lần khi nhảy xa.
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <select
                  value={month}
                  onChange={e => setView(new Date(year, Number(e.target.value), 1))}
                  aria-label="Chọn tháng"
                  className="appearance-none bg-transparent pl-2 pr-6 py-1 text-sm font-semibold text-ink rounded-lg hover:bg-sand focus:outline-none focus:ring-2 focus:ring-bean/35 cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>Tháng {i + 1}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-cafe-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={year}
                  onChange={e => setView(new Date(Number(e.target.value), month, 1))}
                  aria-label="Chọn năm"
                  className="appearance-none bg-transparent pl-2 pr-6 py-1 text-sm font-semibold text-ink rounded-lg hover:bg-sand focus:outline-none focus:ring-2 focus:ring-bean/35 cursor-pointer"
                >
                  {years.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-cafe-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          ) : (
            <span className="text-sm font-semibold text-ink">Tháng {month + 1}, {year}</span>
          )}

          {/* Nút tiến tháng nằm ở lịch phải; trên điện thoại lịch phải bị ẩn nên
              lịch trái giữ chỗ nút này, còn trên desktop thì để trống cho cân. */}
          <button
            type="button"
            onClick={() => setView(new Date(y, m + (offset === 0 ? 1 : 0), 1))}
            aria-label="Tháng sau"
            tabIndex={offset === 0 ? -1 : 0}
            className={`p-1.5 rounded-lg text-cafe-500 hover:bg-sand hover:text-bean transition-colors ${
              offset === 0 ? 'sm:invisible sm:pointer-events-none' : ''
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {WEEKDAYS.map(w => (
            <span key={w} className="h-8 grid place-items-center text-[11px] font-semibold text-cafe-400">
              {w}
            </span>
          ))}
          {monthGrid(year, month).map((d, i) => {
            if (d === null) return <span key={i} className="h-9" />;
            const key = `${year}-${pad(month + 1)}-${pad(d)}`;
            const isStart = !!draftFrom && key === draftFrom;
            const isEnd = !!rangeEnd && key === rangeEnd && rangeEnd !== draftFrom;
            const isEdge = isStart || isEnd;
            // Ô giữa khoảng để vuông góc để các ngày nối liền thành một dải liền mạch.
            const inRange = !!draftFrom && !!rangeEnd && key > draftFrom && key < rangeEnd;

            return (
              <button
                key={i}
                type="button"
                onClick={() => pickDay(key)}
                onMouseEnter={() => setHover(key)}
                className={`h-9 text-sm relative transition-colors ${
                  isEdge
                    ? 'bg-bean text-white font-semibold rounded-lg'
                    : inRange
                      ? 'bg-bean-tint text-bean font-medium'
                      : 'text-ink hover:bg-sand rounded-lg'
                }`}
              >
                {d}
                {key === todayKey && !isEdge && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-bean" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 border rounded-xl px-3.5 py-2.5 text-sm bg-white transition-colors duration-150 hover:border-cafe-300 focus:outline-none focus:ring-2 focus:ring-bean/35 ${
          open ? 'border-bean ring-2 ring-bean/35' : 'border-line'
        } ${from || to ? 'text-ink font-medium' : 'text-cafe-400'}`}
      >
        <CalendarDays className="w-4 h-4 text-cafe-400 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown className={`w-4 h-4 text-cafe-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chọn khoảng ngày"
          className="absolute z-50 mt-2 left-0 w-[min(calc(100vw-2rem),50rem)] rounded-2xl border border-line bg-white shadow-xl shadow-ink/10 overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row">
            {/* Lối tắt: trên điện thoại là hàng chip cuộn ngang cho đỡ chiếm chỗ. */}
            <div className="sm:w-44 sm:border-r border-line bg-paper/60 p-2 shrink-0">
              <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`whitespace-nowrap text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                      activePreset === p.label
                        ? 'bg-bean text-white font-semibold'
                        : 'text-ink/75 hover:bg-bean-tint hover:text-bean'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="flex-1 p-4 flex gap-6 justify-center"
              onMouseLeave={() => setHover('')}
            >
              {renderMonth(0)}
              <div className="hidden sm:block">{renderMonth(1)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-line bg-paper/60">
            <p className="text-sm text-cafe-600">
              {draftFrom
                ? <>Đã chọn: <span className="font-semibold text-ink">
                    {draftTo && draftTo !== draftFrom ? `${display(draftFrom)} – ${display(draftTo)}` : display(draftFrom)}
                  </span></>
                : <span className="text-cafe-400">Tất cả thời gian</span>}
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary !py-2 !px-3.5">
                Hủy
              </button>
              <button type="button" onClick={commit} className="btn-primary !py-2 !px-3.5">
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
