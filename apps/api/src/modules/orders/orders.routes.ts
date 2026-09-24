import { cancelOrderSchema, idParamsSchema, pageQuerySchema } from '@ecommerce/validation';
import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { handle, sendData, sendPage } from '../../utils/http.js';
import { createOrdersService } from './orders.service.js';

export function createOrdersRouter(ctx: AppContext): Router {
  const service = createOrdersService(ctx);
  const router = Router();
  router.use(requireAuth(ctx.accessTokens));

  router.get(
    '/',
    handle(async (req, res) => {
      sendPage(res, await service.list(getAuth(req).userId, pageQuerySchema.parse(req.query)));
    }),
  );

  router.get(
    '/:id',
    handle(async (req, res) => {
      const { id } = idParamsSchema.parse(req.params);
      sendData(res, await service.detail(getAuth(req).userId, id));
    }),
  );

  router.post(
    '/:id/cancel',
    handle(async (req, res) => {
      const { id } = idParamsSchema.parse(req.params);
      const { reason } = cancelOrderSchema.parse(req.body ?? {});
      sendData(res, await service.cancel(getAuth(req).userId, id, reason));
    }),
  );

  return router;
}
