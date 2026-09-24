import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

/** Pages to show around the current one, with gaps collapsed to an ellipsis. */
function pageList(page: number, total: number): (number | 'gap')[] {
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);

  return sorted.flatMap((value, index) => {
    const previous = sorted[index - 1];
    return previous !== undefined && value - previous > 1 ? (['gap', value] as const) : [value];
  });
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const arrow =
    'grid size-11 place-items-center rounded-full border border-border transition hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40';

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
      <button
        type="button"
        className={arrow}
        disabled={page <= 1}
        onClick={() => {
          onChange(page - 1);
        }}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </button>
      {pageList(page, totalPages).map((entry, index) =>
        entry === 'gap' ? (
          <span key={`gap-${String(index)}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => {
              onChange(entry);
            }}
            aria-current={entry === page ? 'page' : undefined}
            className={cn(
              'relative grid size-11 place-items-center rounded-full text-sm font-medium',
              entry === page ? 'text-bg' : 'hover:bg-surface-2',
            )}
          >
            {entry === page && (
              <motion.span
                layoutId="page-active"
                className="absolute inset-0 rounded-full bg-fg"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{entry}</span>
          </button>
        ),
      )}
      <button
        type="button"
        className={arrow}
        disabled={page >= totalPages}
        onClick={() => {
          onChange(page + 1);
        }}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
