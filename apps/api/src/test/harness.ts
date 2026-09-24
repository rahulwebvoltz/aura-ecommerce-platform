import { createPrismaClient, type DatabaseClient } from '@ecommerce/db';
import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '../app.js';
import { type Env, parseEnv } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import type { AppContext } from '../context.js';
import { createAccessTokenService } from '../services/access-token.js';
import type { MailMessage, Mailer } from '../services/mailer.js';
import { createRazorpayGateway, type RazorpayGateway } from '../services/razorpay.js';
import { testDatabaseUrl } from './database-url.js';

export const RAZORPAY_KEY_SECRET = 'rzp_test_secret_value';
export const RAZORPAY_WEBHOOK_SECRET = 'rzp_test_webhook_secret';

export function testEnv(overrides: Record<string, string | undefined> = {}): Env {
  return parseEnv({
    NODE_ENV: 'test',
    PORT: '4000',
    DATABASE_URL: testDatabaseUrl(),
    APP_URL: 'http://localhost:5173',
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-123',
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET,
    ...overrides,
  });
}

export interface CapturingMailer extends Mailer {
  messages: MailMessage[];
  /** Extracts the `token` query parameter from the most recent email sent to `to`. */
  lastToken(to: string): string;
}

export function createCapturingMailer(): CapturingMailer {
  const messages: MailMessage[] = [];
  return {
    messages,
    send(message) {
      messages.push(message);
      return Promise.resolve();
    },
    lastToken(to) {
      const message = messages.filter((entry) => entry.to === to).at(-1);
      const token = message?.text.match(/token=([A-Za-z0-9_-]+)/u)?.[1];
      if (token === undefined) {
        throw new Error(`No token email was sent to ${to}.`);
      }
      return token;
    },
  };
}

export interface FakeRazorpay {
  orders: { amount: number; receipt: string }[];
  refunds: { paymentId: string; amount: number }[];
  /** When true, the next API call responds with HTTP 500. */
  failNext: boolean;
  fetch: typeof fetch;
}

/** Stands in for api.razorpay.com so the real gateway code runs without network access. */
export function createFakeRazorpay(): FakeRazorpay {
  const fake: FakeRazorpay = {
    orders: [],
    refunds: [],
    failNext: false,
    fetch: (input, init) => {
      if (fake.failNext) {
        fake.failNext = false;
        return Promise.resolve(new Response('{}', { status: 500 }));
      }

      const url = input instanceof Request ? input.url : input.toString();
      const bodyText = typeof init?.body === 'string' ? init.body : '{}';
      const body = z
        .object({ amount: z.number(), receipt: z.string().optional() })
        .parse(JSON.parse(bodyText));

      if (url.endsWith('/orders')) {
        fake.orders.push({ amount: body.amount, receipt: body.receipt ?? '' });
        const id = `order_fake${String(fake.orders.length)}`;
        return Promise.resolve(Response.json({ id, amount: body.amount, currency: 'INR' }));
      }

      const paymentId = /payments\/([^/]+)\/refund$/u.exec(url)?.[1] ?? 'unknown';
      fake.refunds.push({ paymentId, amount: body.amount });
      return Promise.resolve(Response.json({ id: `rfnd_fake${String(fake.refunds.length)}` }));
    },
  };
  return fake;
}

export interface TestContext {
  ctx: AppContext;
  app: Express;
  prisma: DatabaseClient;
  mailer: CapturingMailer;
  razorpay: FakeRazorpay;
  /** Moves the context clock; defaults to real time. */
  setNow(date: Date | null): void;
}

let sharedPrisma: DatabaseClient | null = null;

function prismaClient(): DatabaseClient {
  sharedPrisma ??= createPrismaClient({ databaseUrl: testDatabaseUrl() });
  return sharedPrisma;
}

export function createTestContext(
  options: { env?: Env; razorpay?: RazorpayGateway | null } = {},
): TestContext {
  const env = options.env ?? testEnv();
  const mailer = createCapturingMailer();
  const razorpay = createFakeRazorpay();
  let now: Date | null = null;

  const gateway =
    options.razorpay === undefined
      ? createRazorpayGateway({
          keyId: 'rzp_test_key',
          keySecret: RAZORPAY_KEY_SECRET,
          webhookSecret: RAZORPAY_WEBHOOK_SECRET,
          fetchImpl: razorpay.fetch,
        })
      : options.razorpay;

  const ctx: AppContext = {
    env,
    prisma: prismaClient(),
    logger: createLogger(env),
    mailer,
    accessTokens: createAccessTokenService(env.JWT_ACCESS_SECRET, env.JWT_ACCESS_TTL_SECONDS),
    razorpay: gateway,
    now: () => now ?? new Date(),
  };

  return {
    ctx,
    app: createApp(ctx),
    prisma: ctx.prisma,
    mailer,
    razorpay,
    setNow: (date) => {
      now = date;
    },
  };
}

/** Empties every table. Truncating the root tables cascades to all dependents. */
export async function resetDatabase(prisma: DatabaseClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "users", "categories", "brands", "coupons", "webhook_events" RESTART IDENTITY CASCADE',
  );
}

export async function disconnect(): Promise<void> {
  if (sharedPrisma !== null) {
    await sharedPrisma.$disconnect();
    sharedPrisma = null;
  }
}

const sessionSchema = z.object({
  data: z.object({ accessToken: z.string(), user: z.object({ id: z.string() }) }),
});

export interface Session {
  token: string;
  userId: string;
  cookie: string;
  auth: { authorization: string };
}

function refreshCookie(header: unknown): string {
  const cookies = z.array(z.string()).parse(header);
  const cookie = cookies.find((entry) => entry.startsWith('refresh_token='));
  if (cookie === undefined) {
    throw new Error('No refresh cookie was set.');
  }
  return cookie.split(';')[0] ?? '';
}

export async function login(app: Express, email: string, password: string): Promise<Session> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed with ${String(response.status)}.`);
  }

  const { data } = sessionSchema.parse(response.body);
  return {
    token: data.accessToken,
    userId: data.user.id,
    cookie: refreshCookie(response.headers['set-cookie']),
    auth: { authorization: `Bearer ${data.accessToken}` },
  };
}

export function extractRefreshCookie(header: unknown): string {
  return refreshCookie(header);
}

/** Reads `body.data` with a schema so tests stay type-safe. */
export function dataOf<T>(body: unknown, schema: z.ZodType<T>): T {
  return schema.parse(z.object({ data: z.unknown() }).parse(body).data);
}

export const errorCodeOf = (body: unknown): string =>
  z.object({ error: z.object({ code: z.string() }) }).parse(body).error.code;
