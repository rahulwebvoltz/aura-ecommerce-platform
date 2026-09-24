import { createPrismaClient } from '@ecommerce/db';

import type { Env } from './config/env.js';
import { createLogger } from './config/logger.js';
import type { AppContext } from './context.js';
import { createAccessTokenService } from './services/access-token.js';
import { createLogMailer } from './services/mailer.js';
import { createRazorpayGateway } from './services/razorpay.js';

/** Wires production dependencies from validated configuration. */
export function createContext(env: Env): AppContext {
  const logger = createLogger(env);
  const razorpay =
    env.RAZORPAY_KEY_ID !== undefined && env.RAZORPAY_KEY_SECRET !== undefined
      ? createRazorpayGateway({
          keyId: env.RAZORPAY_KEY_ID,
          keySecret: env.RAZORPAY_KEY_SECRET,
          webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
        })
      : null;

  return {
    env,
    logger,
    prisma: createPrismaClient({ databaseUrl: env.DATABASE_URL }),
    mailer: createLogMailer(logger),
    accessTokens: createAccessTokenService(env.JWT_ACCESS_SECRET, env.JWT_ACCESS_TTL_SECONDS),
    razorpay,
    now: () => new Date(),
  };
}
