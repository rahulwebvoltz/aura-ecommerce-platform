import { SLUG_PATTERN } from '@ecommerce/shared';
import { z } from 'zod';

export const idSchema = z.uuid({ error: 'Invalid identifier.' });

export const idParamsSchema = z.object({ id: idSchema });
export type IdParams = z.infer<typeof idParamsSchema>;

export const productIdParamsSchema = z.object({ productId: idSchema });
export type ProductIdParams = z.infer<typeof productIdParamsSchema>;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(160)
  .regex(SLUG_PATTERN, { error: 'Invalid slug.' });

export const slugParamsSchema = z.object({ slug: slugSchema });
export type SlugParams = z.infer<typeof slugParamsSchema>;

/** Trimmed, non-empty text with a maximum length. */
export function requiredText(max: number, label: string) {
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, { error: `${label} is required.` })
    .max(max, { error: `${label} must be at most ${String(max)} characters.` });
}

/** Optional text where empty strings are normalised to null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value));
}

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;
