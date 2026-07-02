import type { MenuItem } from '@/types';
import { formatCurrency } from '@/lib/format';

interface Props {
  item: MenuItem;
  onClick?: () => void;
}

/** Thẻ món trong lưới chọn món (POS). Ảnh 4:3, giá từ, nhãn size/topping. */
export default function MenuCard({ item, onClick }: Props) {
  const activeSizes = item.sizes.filter((s) => s.isActive);
  const minPrice = item.hasSize && activeSizes.length > 0
    ? Math.min(...activeSizes.map((s) => s.price))
    : item.basePrice;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl border border-line bg-white overflow-hidden flex flex-col transition-all duration-200 hover:border-cafe-300 hover:shadow-card hover:-translate-y-0.5"
    >
      <div className="relative w-full aspect-[4/3] bg-sand overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-3xl text-bean/40 transition-colors group-hover:bg-bean-tint">☕</div>
        )}
        {(item.hasSize || item.allowTopping) && (
          <div className="absolute top-2 left-2 flex gap-1">
            {item.hasSize && <span className="text-[10px] font-semibold bg-white/90 text-bean px-1.5 py-0.5 rounded-md shadow-soft">Size</span>}
            {item.allowTopping && <span className="text-[10px] font-semibold bg-white/90 text-pine px-1.5 py-0.5 rounded-md shadow-soft">Topping</span>}
          </div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-semibold text-ink line-clamp-2 leading-snug">{item.name}</p>
        <p className="text-sm text-bean mt-auto pt-1.5 font-bold">
          {item.hasSize ? <span className="text-xs font-medium text-cafe-400">Từ </span> : null}
          {formatCurrency(minPrice)}
        </p>
      </div>
    </button>
  );
}
