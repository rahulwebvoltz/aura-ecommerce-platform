import { checkoutSchema, validateCouponSchema } from '@ecommerce/validation';
import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../../context.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { handle, sendData } from '../../utils/http.js';
import { createCheckoutService } from './checkout.service.js';

const idempotencyKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{8,64}$/u, { error: 'Invalid Idempotency-Key header.' })
  .optional();

export function createCheckoutRouter(ctx: AppContext): Router {
  const service = createCheckoutService(ctx);
  const router = Router();
  router.use(requireAuth(ctx.accessTokens));

  router.post(
    '/',
    handle(async (req, res) => {
      const input = checkoutSchema.parse(req.body);
      const key = idempotencyKeySchema.parse(req.get('idempotency-key')) ?? null;
      const { result, replayed } = await service.checkout(getAuth(req).userId, input, key);
      if (replayed) {
        res.setHeader('Idempotent-Replayed', 'true');
      }
      sendData(res, result, replayed ? 200 : 201);
    }),
  );

  router.post(
    '/validate-coupon',
    handle(async (req, res) => {
      const { code } = validateCouponSchema.parse(req.body);
      sendData(res, await service.validateCoupon(getAuth(req).userId, code));
    }),
  );

  return router;
}
