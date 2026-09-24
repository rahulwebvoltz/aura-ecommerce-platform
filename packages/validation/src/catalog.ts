import { PAGINATION, PRODUCT_SORTS } from '@ecommerce/shared';
import { z } from 'zod';

import { slugSchema } from './common.js';

const ATTRIBUTE_FILTER_PATTERN = /^[a-z][a-z0-9_]{0,31}:[^:]{1,64}$/iu;

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

const listParam = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform(toArray);

const priceParam = z.coerce.number().min(0).max(10_000_000).optional();

/**
 * Query for `GET /api/products`.
 *
 * - `minPrice` / `maxPrice` are in major units (rupees) for readable URLs.
 * - `brand` accepts a comma-separated list or repeated values.
 * - `attr` filters variants by `name:value`, e.g. `attr=color:Black&attr=size:XL`.
 *   Values for the same name are OR-ed; different names are AND-ed on the same variant.
 */
export const productQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: slugSchema.optional(),
    brand: listParam.pipe(z.array(slugSchema).max(20)),
    minPrice: priceParam,
    maxPrice: priceParam,
    inStock: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    attr: listParam.pipe(
      z
        .array(z.string().regex(ATTRIBUTE_FILTER_PATTERN, { error: 'Invalid attribute filter.' }))
        .max(20),
    ),
    sort: z.enum(PRODUCT_SORTS).default('newest'),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { error: 'Minimum price cannot exceed maximum price.', path: ['minPrice'] },
  )
  .transform(({ attr, search, ...rest }) => {
    const attributes: Record<string, string[]> = {};
    for (const filter of attr) {
      const separator = filter.indexOf(':');
      const name = filter.slice(0, separator).toLowerCase();
      const value = filter.slice(separator + 1);
      (attributes[name] ??= []).push(value);
    }

    return {
      ...rest,
      search: search === undefined || search === '' ? undefined : search,
      attributes,
    };
  });
export type ProductQuery = z.infer<typeof productQuerySchema>;
export type ProductQueryInput = z.input<typeof productQuerySchema>;
