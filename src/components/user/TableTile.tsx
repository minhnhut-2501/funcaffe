import { Users } from 'lucide-react';
import type { CafeTable } from '@/types';
import { formatTableStatus } from '@/lib/format';
import StatusBadge, { tableStatusTone } from './StatusBadge';

interface Props {
  table: CafeTable;
  selected?: boolean;
  onClick?: () => void;
}

/** Thẻ chọn bàn — dùng trong POS bán hàng và xem nhanh sơ đồ bàn. */
export default function TableTile({ table, selected = false, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left w-full rounded-xl border p-3 transition-all duration-150 ${
        selected
          ? 'bg-bean border-bean shadow-card -translate-y-0.5'
          : 'bg-white border-line hover:border-cafe-300 hover:shadow-soft hover:-translate-y-0.5'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-bold truncate ${selected ? 'text-white' : 'text-ink'}`}>{table.name}</p>
      </div>
      <p className={`flex items-center gap-1 text-xs mt-0.5 ${selected ? 'text-white/70' : 'text-cafe-400'}`}>
        <Users className="w-3.5 h-3.5" />{table.capacity} chỗ
      </p>
      <div className="mt-2">
        {selected ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white">
            {formatTableStatus(table.status)}
          </span>
        ) : (
          <StatusBadge tone={tableStatusTone[table.status]} className="text-[11px]">
            {formatTableStatus(table.status)}
          </StatusBadge>
        )}
      </div>
    </button>
  );
}
