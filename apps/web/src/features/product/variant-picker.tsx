import type { ProductVariantDto, VariantOptionDto } from '@ecommerce/types';
import { motion } from 'motion/react';

import { cn, humanize } from '@/lib/utils';

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

export type Selection = Record<string, string>;

/** The variant matching every selected option, if one exists. */
export function findVariant(
  variants: ProductVariantDto[],
  selection: Selection,
): ProductVariantDto | undefined {
  return variants.find((variant) =>
    Object.entries(selection).every(([name, value]) => variant.attributes[name] === value),
  );
}

/** Starts from the first in-stock variant so the page opens on something purchasable. */
export function initialSelection(variants: ProductVariantDto[]): Selection {
  const variant = variants.find((entry) => entry.stock > 0) ?? variants[0];
  return variant === undefined ? {} : { ...variant.attributes };
}

export function VariantPicker({
  options,
  variants,
  selection,
  onChange,
}: {
  options: VariantOptionDto[];
  variants: ProductVariantDto[];
  selection: Selection;
  onChange: (selection: Selection) => void;
}) {
  return (
    <div className="space-y-6">
      {options.map((option) => {
        const isColor = option.name === 'color';
        return (
          <fieldset key={option.name}>
            <legend className="mb-3 flex items-baseline gap-2 text-sm">
              <span className="font-semibold">{humanize(option.name)}</span>
              <span className="text-muted">{selection[option.name]}</span>
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {option.values.map((value) => {
                const candidate = { ...selection, [option.name]: value };
                const match = findVariant(variants, candidate);
                const available = match !== undefined && match.stock > 0;
                const selected = selection[option.name] === value;
                const next =
                  match === undefined
                    ? (findVariant(variants, { [option.name]: value })?.attributes ?? candidate)
                    : candidate;

                return isColor ? (
                  <motion.button
                    key={value}
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      onChange({ ...next });
                    }}
                    aria-pressed={selected}
                    aria-label={`${value}${available ? '' : ' (out of stock)'}`}
                    title={value}
                    className="relative grid size-11 place-items-center rounded-full"
                  >
                    {selected && (
                      <motion.span
                        layoutId={`variant-${option.name}`}
                        className="absolute inset-0 rounded-full ring-2 ring-fg"
                        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                      />
                    )}
                    <span
                      className={cn(
                        'size-8 rounded-full border border-black/10 shadow-inner',
                        !available && 'opacity-40',
                      )}
                      style={{ background: SWATCHES[value.toLowerCase()] ?? 'var(--surface-2)' }}
                    />
                    {!available && (
                      <span className="absolute h-px w-9 rotate-45 bg-fg/60" aria-hidden />
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    key={value}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onChange({ ...next });
                    }}
                    aria-pressed={selected}
                    className={cn(
                      'relative min-w-14 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors',
                      selected ? 'border-transparent text-bg' : 'border-border hover:border-fg/40',
                      !available && !selected && 'text-subtle line-through decoration-1',
                    )}
                  >
                    {selected && (
                      <motion.span
                        layoutId={`variant-${option.name}`}
                        className="absolute inset-0 rounded-full bg-fg"
                        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                      />
                    )}
                    <span className="relative">{value}</span>
                  </motion.button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
