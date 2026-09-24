import { z } from 'zod';

const connectionUrl = (...protocols: readonly string[]) =>
  z.url().refine((value) => {
    const parsedUrl = URL.parse(value);
    return parsedUrl !== null && protocols.includes(parsedUrl.protocol);
  });

const httpUrl = connectionUrl('http:', 'https:');
const postgresUrl = connectionUrl('postgres:', 'postgresql:');

const booleanFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? undefined : value.trim()));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65535),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: postgresUrl,
    APP_URL: httpUrl,
    CORS_ORIGINS: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? '')
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      )
      .pipe(z.array(httpUrl)),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    TRUST_PROXY: booleanFlag,
    RAZORPAY_KEY_ID: optionalSecret,
    RAZORPAY_KEY_SECRET: optionalSecret,
    RAZORPAY_WEBHOOK_SECRET: optionalSecret,
  })
  .refine(
    (value) => {
      const razorpay = [value.RAZORPAY_KEY_ID, value.RAZORPAY_KEY_SECRET];
      return razorpay.every((entry) => entry === undefined) || razorpay.every(Boolean);
    },
    { message: 'Razorpay key id and secret must be configured together.' },
  )
  .transform(({ CORS_ORIGINS, APP_URL, ...rest }) => ({
    ...rest,
    APP_URL: APP_URL.replace(/\/+$/u, ''),
    CORS_ORIGINS: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : [new URL(APP_URL).origin],
  }));

export type Env = z.infer<typeof envSchema>;

const ENV_KEYS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'APP_URL',
  'CORS_ORIGINS',
  'JWT_ACCESS_SECRET',
  'JWT_ACCESS_TTL_SECONDS',
  'REFRESH_TOKEN_TTL_DAYS',
  'TRUST_PROXY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const;

/**
 * Validates service configuration from an explicit set of keys. Failures are deliberately generic
 * so that connection strings and secrets never reach logs.
 */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const picked = Object.fromEntries(ENV_KEYS.map((key) => [key, source[key]]));
  const result = envSchema.safeParse(picked);

  if (!result.success) {
    throw new Error('Invalid service configuration.');
  }

  return result.data;
}
