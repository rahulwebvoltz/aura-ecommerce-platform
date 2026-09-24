import type { ApiErrorBody } from '@ecommerce/types';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import type { Env } from '../config/env.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function limiter(env: Pick<Env, 'NODE_ENV'>, limit: number): RequestHandler {
  const tooMany: ApiErrorBody = {
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
  };

  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    handler: (_req, res) => {
      res.status(429).json(tooMany);
    },
  });
}

/** Broad limit for all API traffic. */
export const createGlobalLimiter = (env: Pick<Env, 'NODE_ENV'>) => limiter(env, 1_000);

/** Tight limit for credential and token endpoints to slow brute-force attempts. */
export const createAuthLimiter = (env: Pick<Env, 'NODE_ENV'>) => limiter(env, 20);
