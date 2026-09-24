import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import type { AppContext } from './context.js';
import { CSRF_HEADER } from './middleware/csrf.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createGlobalLimiter } from './middleware/rate-limit.js';
import { requestLog } from './middleware/request-log.js';
import { createAddressesRouter } from './modules/addresses/addresses.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createBrandsRouter } from './modules/brands/brands.routes.js';
import { createCartRouter } from './modules/cart/cart.routes.js';
import { createCategoriesRouter } from './modules/categories/categories.routes.js';
import { createCheckoutRouter } from './modules/checkout/checkout.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createOrdersRouter } from './modules/orders/orders.routes.js';
import {
  createPaymentsRouter,
  createPaymentWebhookRouter,
} from './modules/payments/payments.routes.js';
import { createProductsRouter } from './modules/products/products.routes.js';
import {
  createProductReviewsRouter,
  createReviewsRouter,
} from './modules/reviews/reviews.routes.js';
import { createWishlistRouter } from './modules/wishlist/wishlist.routes.js';

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', ctx.env.TRUST_PROXY ? 1 : false);

  app.use(requestLog(ctx.logger, ['/api/health']));
  app.use(helmet());
  app.use(
    cors({
      origin: ctx.env.CORS_ORIGINS,
      credentials: true,
      allowedHeaders: ['authorization', 'content-type', 'idempotency-key', CSRF_HEADER],
      exposedHeaders: ['idempotent-replayed'],
      maxAge: 600,
    }),
  );
  app.use('/api', createGlobalLimiter(ctx.env));

  // Mounted before the JSON parser: the webhook signature covers the raw request bytes.
  app.use('/api/payments/webhook', createPaymentWebhookRouter(ctx));

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api/health', createHealthRouter(ctx));
  app.use('/api/auth', createAuthRouter(ctx));
  app.use('/api/categories', createCategoriesRouter(ctx));
  app.use('/api/brands', createBrandsRouter(ctx));
  app.use('/api/products/:productId/reviews', createProductReviewsRouter(ctx));
  app.use('/api/products', createProductsRouter(ctx));
  app.use('/api/reviews', createReviewsRouter(ctx));
  app.use('/api/cart', createCartRouter(ctx));
  app.use('/api/wishlist', createWishlistRouter(ctx));
  app.use('/api/addresses', createAddressesRouter(ctx));
  app.use('/api/checkout', createCheckoutRouter(ctx));
  app.use('/api/orders', createOrdersRouter(ctx));
  app.use('/api/payments', createPaymentsRouter(ctx));

  app.use(notFoundHandler);
  app.use(createErrorHandler(ctx.logger));

  return app;
}
