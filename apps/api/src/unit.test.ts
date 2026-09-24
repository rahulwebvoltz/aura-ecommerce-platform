import { Prisma } from '@ecommerce/db';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { parseEnv } from './config/env.js';
import { createLogger, type LogLevel } from './config/logger.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createAuthLimiter } from './middleware/rate-limit.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createContext } from './server.js';
import { createAccessTokenService } from './services/access-token.js';
import { createLogMailer } from './services/mailer.js';
import { createRazorpayGateway, RazorpayRequestError } from './services/razorpay.js';
import {
  generateOrderNumber,
  generateToken,
  hmacSha256Hex,
  safeEqualHex,
  sha256,
} from './utils/crypto.js';
import { AppError, serviceUnavailable } from './utils/errors.js';
import { groupCount } from './utils/prisma.js';

const baseEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  DATABASE_URL: 'postgresql://user:secret-password@db.example.test:5432/app',
  APP_URL: 'https://shop.example.test/',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
};

function configError(overrides: Record<string, string | undefined>): Error {
  try {
    parseEnv({ ...baseEnv, ...overrides });
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
  }
  throw new Error('Configuration unexpectedly parsed.');
}

describe('environment configuration', () => {
  it('parses defaults and derives CORS origins from APP_URL', () => {
    const env = parseEnv(baseEnv);
    expect(env).toMatchObject({
      PORT: 4000,
      LOG_LEVEL: 'info',
      APP_URL: 'https://shop.example.test',
      CORS_ORIGINS: ['https://shop.example.test'],
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
      TRUST_PROXY: false,
      RAZORPAY_KEY_ID: undefined,
    });
  });

  it('accepts explicit origins, flags, and Razorpay keys', () => {
    const env = parseEnv({
      ...baseEnv,
      CORS_ORIGINS: 'https://a.example.test, https://b.example.test',
      TRUST_PROXY: 'true',
      RAZORPAY_KEY_ID: 'rzp_live_x',
      RAZORPAY_KEY_SECRET: ' secret ',
      RAZORPAY_WEBHOOK_SECRET: '',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://a.example.test', 'https://b.example.test']);
    expect(env.TRUST_PROXY).toBe(true);
    expect(env.RAZORPAY_KEY_SECRET).toBe('secret');
    expect(env.RAZORPAY_WEBHOOK_SECRET).toBeUndefined();
  });

  it.each([
    { PORT: '0' },
    { DATABASE_URL: 'mysql://db.example.test/app' },
    { JWT_ACCESS_SECRET: 'short' },
    { APP_URL: 'ftp://shop.example.test' },
    { RAZORPAY_KEY_ID: 'rzp_only_id' },
    { NODE_ENV: 'staging' },
  ])('fails with a generic error for %j', (overrides) => {
    const error = configError(overrides);
    expect(error.message).toBe('Invalid service configuration.');
    expect(`${error.message}${error.stack ?? ''}`).not.toContain('secret-password');
  });
});

describe('logger', () => {
  function capture(level: string, nodeEnv = 'development') {
    const lines: { line: string; level: LogLevel }[] = [];
    const logger = createLogger(
      parseEnv({ ...baseEnv, NODE_ENV: nodeEnv, LOG_LEVEL: level }),
      (line, lineLevel) => lines.push({ line, level: lineLevel }),
    );
    return { logger, lines };
  }

  it('writes JSON lines, redacts secrets, and serialises errors', () => {
    const { logger, lines } = capture('debug');
    logger.child({ requestId: 'r1' }).error(
      {
        password: 'hunter2',
        nested: { token: 't', ok: 1 },
        list: [{ cookie: 'c' }],
        err: new Error('boom'),
      },
      'failed',
    );
    logger.trace({}, 'hidden');
    logger.debug({});

    const record = z.record(z.string(), z.unknown()).parse(JSON.parse(lines[0]?.line ?? '{}'));
    expect(record).toMatchObject({
      level: 'error',
      msg: 'failed',
      requestId: 'r1',
      password: '[redacted]',
      nested: { token: '[redacted]', ok: 1 },
      list: [{ cookie: '[redacted]' }],
      err: { name: 'Error', message: 'boom' },
    });
    expect(lines).toHaveLength(2);
    expect(lines[1]?.line).not.toContain('msg');
  });

  it('is silent in tests and when configured silent', () => {
    for (const [level, nodeEnv] of [
      ['info', 'test'],
      ['silent', 'development'],
    ] as const) {
      const { logger, lines } = capture(level, nodeEnv);
      logger.fatal({}, 'x');
      expect(lines).toHaveLength(0);
    }
  });

  it('routes records to stdout and stderr by default', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = createLogger(parseEnv({ ...baseEnv, NODE_ENV: 'development' }));
    logger.info({}, 'hello');
    logger.warn({}, 'careful');
    logger.fatal({}, 'bad');
    expect(out).toHaveBeenCalledTimes(2);
    expect(err).toHaveBeenCalledTimes(1);
    out.mockRestore();
    err.mockRestore();
  });

  it('logs mail through the development mailer', async () => {
    const { logger, lines } = capture('info');
    await createLogMailer(logger).send({ to: 'a@example.test', subject: 'Hi', text: 'Body' });
    expect(lines[0]?.line).toContain('Email to a@example.test: Hi');
  });
});

describe('crypto helpers', () => {
  it('generates distinct URL-safe tokens and stable hashes', () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(generateToken()).not.toBe(generateToken());
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('compares hex digests in constant time', () => {
    const digest = hmacSha256Hex('key', 'payload');
    expect(safeEqualHex(digest, digest)).toBe(true);
    expect(safeEqualHex(digest, 'ab')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });

  it('formats order numbers', () => {
    expect(generateOrderNumber(new Date('2026-09-24T10:00:00Z'))).toMatch(
      /^ORD-260924-[A-HJ-NP-Z2-9]{6}$/u,
    );
    expect(generateOrderNumber()).toMatch(/^ORD-\d{6}-/u);
  });

  it('reads Prisma group counts defensively', () => {
    expect(groupCount({ _all: 3 })).toBe(3);
    expect(groupCount({ rating: 2 }, 'rating')).toBe(2);
    expect(groupCount({ _all: 'x' })).toBe(0);
    expect(groupCount(true)).toBe(0);
  });
});

describe('access tokens', () => {
  const tokens = createAccessTokenService('s'.repeat(40), 900);
  const userId = '0190a5f1-7c1e-7b3a-9f10-2b3c4d5e6f70';

  it('round-trips claims', () => {
    expect(tokens.verify(tokens.sign({ userId, role: 'CUSTOMER' }))).toEqual({
      userId,
      role: 'CUSTOMER',
    });
  });

  it('rejects tampered, foreign, and malformed tokens', () => {
    const other = createAccessTokenService('o'.repeat(40), 900);
    expect(tokens.verify(other.sign({ userId, role: 'ADMIN' }))).toBeNull();
    expect(tokens.verify('not.a.token')).toBeNull();

    const wrongShape = jwt.sign({ role: 'ROOT' }, 's'.repeat(40), {
      audience: 'ecommerce-web',
      issuer: 'ecommerce-api',
      subject: userId,
    });
    expect(tokens.verify(wrongShape)).toBeNull();
  });
});

describe('Razorpay gateway', () => {
  function gateway(response: Response, webhookSecret: string | undefined = 'wh') {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(response));
    return {
      fetchImpl,
      client: createRazorpayGateway({
        keyId: 'rzp_id',
        keySecret: 'rzp_secret',
        webhookSecret,
        fetchImpl,
      }),
    };
  }

  it('creates orders and refunds with basic auth', async () => {
    const { client, fetchImpl } = gateway(
      Response.json({ id: 'order_1', amount: 100, currency: 'INR' }),
    );
    await expect(
      client.createOrder({ amount: 100, currency: 'INR', receipt: 'r', notes: {} }),
    ).resolves.toEqual({ id: 'order_1', amount: 100, currency: 'INR' });

    const init = fetchImpl.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Basic ${Buffer.from('rzp_id:rzp_secret').toString('base64')}`,
    );

    const refund = gateway(Response.json({ id: 'rfnd_1' }));
    await expect(refund.client.refundPayment('pay/1', 100)).resolves.toEqual({ id: 'rfnd_1' });
    expect(refund.fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/payments/pay%2F1/refund'),
      expect.anything(),
    );
  });

  it('throws a typed error for failed requests', async () => {
    const { client } = gateway(new Response('{}', { status: 401 }));
    await expect(client.refundPayment('pay_1', 1)).rejects.toBeInstanceOf(RazorpayRequestError);
  });

  it('verifies payment and webhook signatures', () => {
    const { client } = gateway(Response.json({}));
    const signature = hmacSha256Hex('rzp_secret', 'order_1|pay_1');
    expect(
      client.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature }),
    ).toBe(true);
    expect(
      client.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_2', signature }),
    ).toBe(false);

    const body = Buffer.from('{"a":1}');
    expect(client.verifyWebhookSignature(body, hmacSha256Hex('wh', body))).toBe(true);
    expect(gateway(Response.json({}), undefined).client.verifyWebhookSignature(body, 'x')).toBe(
      false,
    );
  });
});

describe('error handling', () => {
  function appThrowing(error: unknown, afterHeaders = false) {
    const app = express();
    app.get('/', (_req, res, next) => {
      if (afterHeaders) {
        res.write('partial');
      }
      next(error);
    });
    app.use(createErrorHandler(createLogger(parseEnv(baseEnv))));
    return app;
  }

  it.each([
    [new AppError(418, 'TEAPOT', 'Short and stout.'), 418, 'TEAPOT'],
    [serviceUnavailable('DOWN', 'Down.'), 503, 'DOWN'],
    [Object.assign(new Error('bad json'), { type: 'entity.parse.failed' }), 400, 'INVALID_JSON'],
    [Object.assign(new Error('big'), { type: 'entity.too.large' }), 413, 'PAYLOAD_TOO_LARGE'],
    [Object.assign(new Error('other'), { type: 42 }), 500, 'INTERNAL_ERROR'],
    [
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
      409,
      'CONFLICT',
    ],
    [
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: 'test' }),
      404,
      'NOT_FOUND',
    ],
    [new Error('secret internals'), 500, 'INTERNAL_ERROR'],
  ])('maps %s to %i %s', async (error, status, code) => {
    const response = await request(appThrowing(error)).get('/');
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ error: { code } });
    expect(JSON.stringify(response.body)).not.toContain('secret internals');
  });

  it('delegates to Express, which aborts the response, once headers are sent', async () => {
    await expect(request(appThrowing(new Error('late'), true)).get('/')).rejects.toThrow('aborted');
  });

  it('rate limits outside the test environment', async () => {
    const app = express();
    app.use(createAuthLimiter(parseEnv({ ...baseEnv, NODE_ENV: 'production' })));
    app.get('/', (_req, res) => {
      res.send('ok');
    });

    let last = 0;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      last = (await request(app).get('/')).status;
    }
    expect(last).toBe(429);
  });
});

describe('health and wiring', () => {
  it('reports a degraded database', async () => {
    // Nothing listens on port 1, so the health query fails fast.
    const ctx = createContext(
      parseEnv({ ...baseEnv, DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/none' }),
    );
    const app = express().use('/health', createHealthRouter(ctx));

    const response = await request(app).get('/health');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ data: { status: 'degraded', database: 'unavailable' } });
    await ctx.prisma.$disconnect();
  });

  it('builds production contexts with and without Razorpay', async () => {
    const plain = createContext(parseEnv(baseEnv));
    expect(plain.razorpay).toBeNull();
    expect(plain.now()).toBeInstanceOf(Date);

    const withRazorpay = createContext(
      parseEnv({ ...baseEnv, RAZORPAY_KEY_ID: 'id', RAZORPAY_KEY_SECRET: 'secret' }),
    );
    expect(withRazorpay.razorpay?.keyId).toBe('id');
    await Promise.all([plain.prisma.$disconnect(), withRazorpay.prisma.$disconnect()]);
  });
});
