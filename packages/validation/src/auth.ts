import { z } from 'zod';

import { requiredText } from './common.js';

export const emailSchema = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }).max(254));

export const passwordSchema = z
  .string({ error: 'Password is required.' })
  .min(8, { error: 'Password must be at least 8 characters.' })
  .max(128, { error: 'Password must be at most 128 characters.' })
  .regex(/[A-Za-z]/u, { error: 'Password must contain a letter.' })
  .regex(/[0-9]/u, { error: 'Password must contain a number.' });

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{6,18}[0-9]$/u, { error: 'Enter a valid phone number.' });

const nameSchema = (label: string) => requiredText(60, label);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema('First name'),
  lastName: nameSchema('Last name'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

const tokenSchema = z.string().trim().min(32).max(256);

export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: tokenSchema });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const updateProfileSchema = z
  .object({
    firstName: nameSchema('First name').optional(),
    lastName: nameSchema('Last name').optional(),
    phone: phoneSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: 'Provide at least one field to update.',
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.').max(128),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    error: 'New password must be different from the current password.',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
