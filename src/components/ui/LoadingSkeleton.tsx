interface Props {
  variant?: 'table' | 'card' | 'list';
  rows?: number;
  cols?: number;
}

export default function LoadingSkeleton({ variant = 'table', rows = 5, cols = 1 }: Props) {
  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-cafe-100 p-6 animate-pulse">
            <div className="h-5 bg-cafe-100 rounded w-2/3 mb-3" />
            <div className="h-3 bg-cafe-50 rounded w-full mb-2" />
            <div className="h-3 bg-cafe-50 rounded w-4/5 mb-4" />
            <div className="space-y-2">
              <div className="h-3 bg-cafe-50 rounded w-full" />
              <div className="h-3 bg-cafe-50 rounded w-full" />
              <div className="h-3 bg-cafe-50 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-cafe-50">
            <div className="w-6 h-6 bg-cafe-100 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-cafe-100 rounded w-1/3" />
              <div className="h-2.5 bg-cafe-50 rounded w-1/2" />
            </div>
            <div className="h-4 bg-cafe-100 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-cafe-100 animate-pulse">
      <div className="bg-cafe-50 px-4 py-3 flex gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-cafe-200 rounded flex-1" />
        ))}
      </div>
      <div className="divide-y divide-cafe-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex gap-6">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-3 bg-cafe-50 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
