import {
  idParamsSchema,
  productIdParamsSchema,
  reviewQuerySchema,
  reviewSchema,
  updateReviewSchema,
} from '@ecommerce/validation';
import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { getAuth, getOptionalAuth, optionalAuth, requireAuth } from '../../middleware/auth.js';
import { handle, sendData, sendPage } from '../../utils/http.js';
import { createReviewsService } from './reviews.service.js';

/** Mounted at `/api/products/:productId/reviews`. */
export function createProductReviewsRouter(ctx: AppContext): Router {
  const service = createReviewsService(ctx);
  const router = Router({ mergeParams: true });

  router.get(
    '/',
    handle(async (req, res) => {
      const { productId } = productIdParamsSchema.parse(req.params);
      sendPage(res, await service.list(productId, reviewQuerySchema.parse(req.query)));
    }),
  );

  router.get(
    '/eligibility',
    optionalAuth(ctx.accessTokens),
    handle(async (req, res) => {
      const { productId } = productIdParamsSchema.parse(req.params);
      sendData(res, await service.eligibility(getOptionalAuth(req)?.userId ?? null, productId));
    }),
  );

  router.post(
    '/',
    requireAuth(ctx.accessTokens),
    handle(async (req, res) => {
      const { productId } = productIdParamsSchema.parse(req.params);
      const input = reviewSchema.parse(req.body);
      sendData(res, await service.create(getAuth(req).userId, productId, input), 201);
    }),
  );

  return router;
}

/** Mounted at `/api/reviews`. */
export function createReviewsRouter(ctx: AppContext): Router {
  const service = createReviewsService(ctx);
  const router = Router();
  router.use(requireAuth(ctx.accessTokens));

  router.patch(
    '/:id',
    handle(async (req, res) => {
      const { id } = idParamsSchema.parse(req.params);
      const input = updateReviewSchema.parse(req.body);
      sendData(res, await service.update(getAuth(req).userId, id, input));
    }),
  );

  router.delete(
    '/:id',
    handle(async (req, res) => {
      const { id } = idParamsSchema.parse(req.params);
      await service.remove(getAuth(req).userId, id);
      res.status(204).end();
    }),
  );

  return router;
}
