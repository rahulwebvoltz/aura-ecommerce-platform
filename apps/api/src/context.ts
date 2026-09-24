import type { DatabaseClient } from '@ecommerce/db';

import type { Env } from './config/env.js';
import type { Logger } from './config/logger.js';
import type { AccessTokenService } from './services/access-token.js';
import type { Mailer } from './services/mailer.js';
import type { RazorpayGateway } from './services/razorpay.js';

/** Everything a module needs, created once at startup and replaceable in tests. */
export interface AppContext {
  env: Env;
  prisma: DatabaseClient;
  logger: Logger;
  mailer: Mailer;
  accessTokens: AccessTokenService;
  /** Null when Razorpay credentials are not configured. */
  razorpay: RazorpayGateway | null;
  now: () => Date;
}
