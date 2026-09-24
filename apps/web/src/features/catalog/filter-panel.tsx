import { formatMoney, toMajorUnits } from '@ecommerce/shared';
import type { ProductFacetsDto } from '@ecommerce/types';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';

import { Skeleton } from '@/components/ui/display';
import { cn, humanize } from '@/lib/utils';

import type { ProductFiltersController } from './use-product-filters';

const SWATCHES: Record<string, string> = {
  black: '#111114',
  'midnight black': '#14161f',
  white: '#f7f7f5',
  'glacier white': '#eef3f7',
  navy: '#1f2a4d',
  'ocean blue': '#2d6cdf',
  'sky blue': '#8ec5f0',
  olive: '#6b7445',
  'sage green': '#9fb69a',
  maroon: '#6d1f2f',
  sand: '#d8c6a3',
  grey: '#8a8d93',
  titanium: '#a7a39b',
};

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-border py-5">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-2 text-left text-sm font-semibold"
      >
        {title}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <ChevronDown className="size-4 text-muted" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CheckRow({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean;
  label: string;
  count: number;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="group flex w-full items-center gap-3 rounded-lg py-1.5 text-left text-sm"
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
          checked ? 'border-fg bg-fg text-bg' : 'border-border group-hover:border-fg/40',
        )}
      >
        <AnimatePresence>
          {checked && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Check className="size-3.5" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-subtle tabular-nums">{count}</span>
    </button>
  );
}

/** Two-thumb price slider in rupees, committing when the thumb is released. */
function PriceRange({
  min,
  max,
  value,
  onCommit,
}: {
  min: number;
  max: number;
  value: [number | undefined, number | undefined];
  onCommit: (min: number | undefined, max: number | undefined) => void;
}) {
  const [low, setLow] = useState(value[0] ?? min);
  const [high, setHigh] = useState(value[1] ?? max);
  const span = Math.max(max - min, 1);
  const step = Math.max(Math.round(span / 100), 1);
  const commit = () => {
    onCommit(low <= min ? undefined : low, high >= max ? undefined : high);
  };
  const thumb =
    'pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg [&::-webkit-slider-thumb]:bg-fg [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-bg [&::-moz-range-thumb]:bg-fg';

  return (
    <div className="space-y-4">
      <div className="relative h-5">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-border" />
        <motion.div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
          style={{
            left: `${String(((low - min) / span) * 100)}%`,
            right: `${String(100 - ((high - min) / span) * 100)}%`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          aria-label="Minimum price"
          onChange={(event) => {
            setLow(Math.min(Number(event.target.value), high - step));
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          className={thumb}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          aria-label="Maximum price"
          onChange={(event) => {
            setHigh(Math.max(Number(event.target.value), low + step));
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          className={thumb}
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="rounded-full bg-surface-2 px-3 py-1 font-medium tabular-nums">
          {formatMoney(low * 100)}
        </span>
        <span className="text-subtle">to</span>
        <span className="rounded-full bg-surface-2 px-3 py-1 font-medium tabular-nums">
          {formatMoney(high * 100)}
        </span>
      </div>
    </div>
  );
}

export function FilterPanel({
  facets,
  loading,
  controller,
}: {
  facets: ProductFacetsDto | undefined;
  loading: boolean;
  controller: ProductFiltersController;
}) {
  const { filters } = controller;
  const [brandQuery, setBrandQuery] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);

  if (loading || facets === undefined) {
    return (
      <div className="space-y-6 py-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  const selectedBrands = new Set(filters.brand);
  const selectedAttributes = new Set(filters.attr);
  const matchingBrands = facets.brands.filter((brand) =>
    brand.name.toLowerCase().includes(brandQuery.toLowerCase()),
  );
  const visibleBrands = showAllBrands ? matchingBrands : matchingBrands.slice(0, 8);
  const minRupees = Math.floor(toMajorUnits(facets.priceRange.min));
  const maxRupees = Math.ceil(toMajorUnits(facets.priceRange.max));

  return (
    <div>
      {facets.categories.length > 1 && (
        <Section title="Category">
          <ul className="space-y-1">
            {facets.categories.map((category) => (
              <li key={category.id}>
                <Link
                  to={`/category/${category.slug}`}
                  className={cn(
                    'flex items-center justify-between rounded-lg py-1.5 text-sm transition hover:text-fg',
                    filters.category === category.slug ? 'font-semibold text-fg' : 'text-fg/75',
                  )}
                >
                  {category.name}
                  <span className="text-xs text-subtle">{category.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {facets.brands.length > 0 && (
        <Section title="Brand">
          {facets.brands.length > 8 && (
            <label className="relative mb-3 block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" />
              <input
                value={brandQuery}
                onChange={(event) => {
                  setBrandQuery(event.target.value);
                }}
                placeholder="Find a brand"
                aria-label="Find a brand"
                className="h-9 w-full rounded-full border border-border bg-surface pr-3 pl-8 text-sm outline-none focus:border-accent"
              />
            </label>
          )}
          <motion.div layout className="space-y-0.5">
            {visibleBrands.map((brand) => (
              <CheckRow
                key={brand.id}
                label={brand.name}
                count={brand.count}
                checked={selectedBrands.has(brand.slug)}
                onChange={() => {
                  controller.toggleBrand(brand.slug);
                }}
              />
            ))}
          </motion.div>
          {matchingBrands.length > 8 && (
            <button
              type="button"
              onClick={() => {
                setShowAllBrands((value) => !value);
              }}
              className="mt-1 py-2 text-sm font-medium text-accent"
            >
              {showAllBrands ? 'Show fewer' : `Show all ${String(matchingBrands.length)}`}
            </button>
          )}
        </Section>
      )}

      {maxRupees > minRupees && (
        <Section title="Price">
          <PriceRange
            key={`${String(minRupees)}-${String(maxRupees)}-${String(filters.minPrice)}-${String(filters.maxPrice)}`}
            min={minRupees}
            max={maxRupees}
            value={[filters.minPrice, filters.maxPrice]}
            onCommit={controller.setPrice}
          />
        </Section>
      )}

      <Section title="Availability">
        <button
          type="button"
          role="switch"
          aria-checked={filters.inStock === true}
          onClick={() => {
            controller.setInStock(filters.inStock !== true);
          }}
          className="flex w-full items-center justify-between py-2 text-sm"
        >
          In stock only
          <span
            className={cn(
              'flex h-6 w-11 items-center rounded-full p-0.5 transition-colors',
              filters.inStock === true ? 'bg-accent' : 'bg-border',
            )}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 600, damping: 32 }}
              className={cn(
                'size-5 rounded-full bg-white shadow',
                filters.inStock === true && 'ml-auto',
              )}
            />
          </span>
        </button>
      </Section>

      {facets.attributes.map((option) => (
        <Section
          key={option.name}
          title={humanize(option.name)}
          defaultOpen={option.name === 'color'}
        >
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const selected = selectedAttributes.has(`${option.name}:${value}`);
              const swatch = option.name === 'color' ? SWATCHES[value.toLowerCase()] : undefined;
              return (
                <motion.button
                  key={value}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  aria-pressed={selected}
                  onClick={() => {
                    controller.toggleAttribute(option.name, value);
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition',
                    selected ? 'border-fg bg-fg text-bg' : 'border-border hover:border-fg/40',
                  )}
                >
                  {swatch !== undefined && (
                    <span
                      className="size-3.5 rounded-full border border-black/10"
                      style={{ background: swatch }}
                    />
                  )}
                  {value}
                </motion.button>
              );
            })}
          </div>
        </Section>
      ))}
    </div>
  );
}

export function ActiveFilters({
  controller,
  facets,
}: {
  controller: ProductFiltersController;
  facets: ProductFacetsDto | undefined;
}) {
  const { filters } = controller;
  const brandName = (slug: string) =>
    facets?.brands.find((brand) => brand.slug === slug)?.name ?? slug;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(filters.brand ?? []).map((slug) => ({
      key: `brand-${slug}`,
      label: brandName(slug),
      remove: () => {
        controller.toggleBrand(slug);
      },
    })),
    ...(filters.attr ?? []).map((entry) => {
      const [name = '', value = ''] = entry.split(':');
      return {
        key: `attr-${entry}`,
        label: `${humanize(name)}: ${value}`,
        remove: () => {
          controller.toggleAttribute(name, value);
        },
      };
    }),
    ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? [
          {
            key: 'price',
            label: `${formatMoney((filters.minPrice ?? 0) * 100)} – ${filters.maxPrice === undefined ? 'any' : formatMoney(filters.maxPrice * 100)}`,
            remove: () => {
              controller.setPrice(undefined, undefined);
            },
          },
        ]
      : []),
    ...(filters.inStock === true
      ? [
          {
            key: 'stock',
            label: 'In stock',
            remove: () => {
              controller.setInStock(false);
            },
          },
        ]
      : []),
  ];

  if (chips.length === 0) {
    return null;
  }

  return (
    <motion.div layout className="flex flex-wrap items-center gap-2">
      <AnimatePresence mode="popLayout">
        {chips.map((chip) => (
          <motion.button
            key={chip.key}
            layout
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={chip.remove}
            className="flex items-center gap-1.5 rounded-full bg-accent-soft py-1.5 pr-2 pl-3 text-xs font-medium text-accent"
            aria-label={`Remove filter ${chip.label}`}
          >
            {chip.label}
            <X className="size-3.5" />
          </motion.button>
        ))}
        <motion.button
          key="clear"
          layout
          type="button"
          onClick={controller.clear}
          className="px-2 text-xs font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Clear all
        </motion.button>
      </AnimatePresence>
    </motion.div>
  );
}
