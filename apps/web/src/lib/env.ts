import { z } from 'zod';

function hasAllowedProtocol(value: string, allowedProtocols: readonly string[]): boolean {
  try {
    return allowedProtocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .url()
    .refine((value) => hasAllowedProtocol(value, ['http:', 'https:']))
    .transform((value) => value.replace(/\/+$/u, '')),
  VITE_APP_ENV: z.enum(['development', 'test', 'production']),
});

export type AppEnv = z.infer<typeof envSchema>;

/** Validates public configuration. Failures never echo the rejected value. */
export function parseAppEnv(source: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error('Invalid application configuration.');
  }

  return result.data;
}

export const env = parseAppEnv(import.meta.env);
