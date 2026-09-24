import { productIdParamsSchema } from '@ecommerce/validation';
import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { handle, sendData } from '../../utils/http.js';
import { createWishlistService } from './wishlist.service.js';

export function createWishlistRouter(ctx: AppContext): Router {
  const service = createWishlistService(ctx);
  const router = Router();
  router.use(requireAuth(ctx.accessTokens));

  router.get(
    '/',
    handle(async (req, res) => {
      sendData(res, await service.get(getAuth(req).userId));
    }),
  );

  router.post(
    '/:productId',
    handle(async (req, res) => {
      const { productId } = productIdParamsSchema.parse(req.params);
      sendData(res, await service.add(getAuth(req).userId, productId));
    }),
  );

  router.delete(
    '/:productId',
    handle(async (req, res) => {
      const { productId } = productIdParamsSchema.parse(req.params);
      sendData(res, await service.remove(getAuth(req).userId, productId));
    }),
  );

  return router;
}
