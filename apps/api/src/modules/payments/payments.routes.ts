import { createPaymentSchema, verifyPaymentSchema } from '@ecommerce/validation';
import express, { Router } from 'express';

import type { AppContext } from '../../context.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { handle, sendData } from '../../utils/http.js';
import { createPaymentsService } from './payments.service.js';

/** The webhook needs the exact raw bytes for signature verification, so it is mounted apart. */
export function createPaymentWebhookRouter(ctx: AppContext): Router {
  const service = createPaymentsService(ctx);
  const router = Router();

  router.post(
    '/',
    express.raw({ type: 'application/json', limit: '256kb' }),
    handle(async (req, res) => {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const result = await service.webhook(
        rawBody,
        req.get('x-razorpay-signature'),
        req.get('x-razorpay-event-id'),
      );
      sendData(res, result);
    }),
  );

  return router;
}

export function createPaymentsRouter(ctx: AppContext): Router {
  const service = createPaymentsService(ctx);
  const authenticated = requireAuth(ctx.accessTokens);
  const router = Router();

  router.get(
    '/methods',
    handle((_req, res) => {
      sendData(res, service.methods());
      return Promise.resolve();
    }),
  );

  router.post(
    '/create',
    authenticated,
    handle(async (req, res) => {
      const { orderId } = createPaymentSchema.parse(req.body);
      sendData(res, await service.create(getAuth(req).userId, orderId));
    }),
  );

  router.post(
    '/verify',
    authenticated,
    handle(async (req, res) => {
      const input = verifyPaymentSchema.parse(req.body);
      sendData(res, await service.verify(getAuth(req).userId, input));
    }),
  );

  return router;
}
