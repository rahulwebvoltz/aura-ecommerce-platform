import { z } from 'zod';

import { phoneSchema } from './auth.js';
import { optionalText, requiredText } from './common.js';

const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/u, { error: 'Use a two-letter country code.' });

// Defaults live only on the create schema; Zod applies inner defaults even through `.partial()`,
// which would silently reset fields on every update.
const addressFields = z.object({
  firstName: requiredText(60, 'First name'),
  lastName: requiredText(60, 'Last name'),
  phone: phoneSchema,
  addressLine1: requiredText(200, 'Address line 1'),
  addressLine2: optionalText(200),
  city: requiredText(100, 'City'),
  state: requiredText(100, 'State'),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{2,10}$/u, { error: 'Enter a valid postal code.' }),
  country: countrySchema,
  isDefault: z.boolean(),
});

export const addressSchema = addressFields.extend({
  country: countrySchema.default('IN'),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;
export type AddressFormValues = z.input<typeof addressSchema>;

export const updateAddressSchema = addressFields
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: 'Provide at least one field to update.',
  });
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
