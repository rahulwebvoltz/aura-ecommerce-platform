import { formatMoney } from '@ecommerce/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, CornerDownLeft, LoaderCircle, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import { Modal } from '@/components/ui/overlay';
import { useCommandShortcut, useDebouncedValue } from '@/hooks/use-utils';
import { queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import { catalogApi } from '@/services/catalog.api';
import { useUiStore } from '@/stores/ui.store';

const RECENT_KEY = 'aura-recent-searches';

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((entry) => typeof entry === 'string').slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string): void {
  try {
    const next = [term, ...readRecent().filter((entry) => entry !== term)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Recent searches are a convenience; ignore storage failures.
  }
}

export function CommandPalette() {
  const open = useUiStore((state) => state.searchOpen);
  const setOpen = useUiStore((state) => state.setSearchOpen);

  const toggle = useCallback(() => {
    setOpen(!useUiStore.getState().searchOpen);
  }, [setOpen]);
  useCommandShortcut(toggle);

  const close = () => {
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={close} title="Search products" position="top" className="max-w-2xl">
      <PaletteBody onClose={close} />
    </Modal>
  );
}

/** Mounted fresh on every open, so the search term and recents always start clean. */
function PaletteBody({ onClose: close }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const [recent] = useState(readRecent);
  const debounced = useDebouncedValue(term.trim(), 220);

  const results = useQuery({
    queryKey: queryKeys.products({ search: debounced, limit: 6 }),
    queryFn: ({ signal }) => catalogApi.products({ search: debounced, limit: 6 }, signal),
    enabled: debounced.length >= 2,
  });
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });

  const products = debounced.length >= 2 ? (results.data?.data ?? []) : [];

  const searchAll = (value: string) => {
    const query = value.trim();
    if (query === '') {
      return;
    }
    saveRecent(query);
    close();
    void navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const openProduct = (slug: string) => {
    if (term.trim() !== '') {
      saveRecent(term.trim());
    }
    close();
    void navigate(`/products/${slug}`);
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const selected = products[active];
          if (selected === undefined) {
            searchAll(term);
          } else {
            openProduct(selected.slug);
          }
        }}
        className="flex items-center gap-3 border-b border-border px-5"
      >
        {results.isFetching ? (
          <LoaderCircle className="size-5 shrink-0 animate-spin text-accent" />
        ) : (
          <Search className="size-5 shrink-0 text-muted" />
        )}
        <input
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, Math.max(products.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
          }}
          placeholder="Search for phones, sneakers, fragrances…"
          aria-label="Search products"
          role="combobox"
          aria-expanded={products.length > 0}
          aria-controls="search-results"
          className="h-16 flex-1 bg-transparent text-lg outline-none placeholder:text-subtle"
        />
        {term !== '' && (
          <button
            type="button"
            onClick={() => {
              setTerm('');
            }}
            className="grid size-8 place-items-center rounded-full hover:bg-surface-2"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
        <kbd className="hidden rounded-lg border border-border px-2 py-1 text-[11px] text-muted sm:block">
          ESC
        </kbd>
      </form>

      <div className="max-h-[60vh] overflow-y-auto p-3">
        <AnimatePresence mode="popLayout">
          {products.length > 0 ? (
            <motion.ul key="results" id="search-results" role="listbox" className="space-y-1">
              {products.map((product, index) => (
                <motion.li
                  key={product.id}
                  role="option"
                  aria-selected={index === active}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.035 }}
                >
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setActive(index);
                    }}
                    onClick={() => {
                      openProduct(product.slug);
                    }}
                    className="relative flex w-full items-center gap-4 rounded-2xl p-2.5 text-left"
                  >
                    {index === active && (
                      <motion.span
                        layoutId="search-active"
                        className="absolute inset-0 rounded-2xl bg-surface-2"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                      {product.image !== null && (
                        <img
                          src={product.image.url}
                          alt=""
                          className="size-full object-contain p-1.5"
                        />
                      )}
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {product.brand?.name ?? product.category.name}
                      </span>
                    </span>
                    <span className="relative text-sm font-semibold">
                      {formatMoney(product.price)}
                    </span>
                    {index === active && <CornerDownLeft className="relative size-4 text-muted" />}
                  </button>
                </motion.li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    searchAll(term);
                  }}
                  className="mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-accent hover:bg-accent-soft"
                >
                  See all results for “{term.trim()}” <ArrowRight className="size-4" />
                </button>
              </li>
            </motion.ul>
          ) : debounced.length >= 2 && results.isSuccess ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-4 py-10 text-center text-muted"
            >
              No products match “{debounced}”.
            </motion.p>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5 p-2"
            >
              {recent.length > 0 && (
                <section>
                  <p className="eyebrow mb-2 px-2">Recent</p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => {
                          searchAll(entry);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:border-fg/30"
                      >
                        <Clock className="size-3.5 text-muted" /> {entry}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <p className="eyebrow mb-2 px-2">Browse</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(categories.data ?? []).map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        close();
                        void navigate(`/category/${category.slug}`);
                      }}
                      className={cn(
                        'group flex items-center gap-3 rounded-2xl border border-border p-2.5 text-left text-sm transition hover:border-accent/40 hover:bg-accent-soft/40',
                      )}
                    >
                      <span className="size-10 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                        {category.image !== null && (
                          <img
                            src={category.image}
                            alt=""
                            className="size-full object-contain p-1 transition group-hover:scale-110"
                          />
                        )}
                      </span>
                      <span className="font-medium">{category.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
