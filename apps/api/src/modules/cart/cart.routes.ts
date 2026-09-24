import {
  addCartItemSchema,
  idParamsSchema,
  mergeCartSchema,
  updateCartItemSchema,
} from '@ecommerce/validation';
import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { handle, sendData } from '../../utils/http.js';
import { createCartService } from './cart.service.js';

export function createCartRouter(ctx: AppContext): Router {
  const service = createCartService(ctx);
  const router = Router();
  router.use(requireAuth(ctx.accessTokens));

  router.get(
    '/',
    handle(async (req, res) => {
      sendData(res, await service.get(getAuth(req).userId));
    }),
  );

  router.post(
    '/items',
    handle(async (req, res) => {
      const input = addCartItemSchema.parse(req.body);
      sendData(res, await service.add(getAuth(req).userId, input), 201);
    }),
  );

  router.post(
    '/merge',
    handle(async (req, res) => {
      const input = mergeCartSchema.parse(req.body);
      sendData(res, await service.merge(getAuth(req).userId, input));
    }),
  );

  router.patch(
    '/items/:id',
    handle(async (req, res) => {
      const { id } = idParamsSchema.parse(req.params);
      const { quantity } = updateCartItemSchema.parse(req.body);
      sendData(res, await service.update(getAuth(req).userId, id, quantity));
    }),
  );

  router.delete(
    '/items/:id',
    handle(async (req, res) => {
      const { id } = idParamsSchema.parse(req.params);
      sendData(res, await service.remove(getAuth(req).userId, id));
    }),
  );

  router.delete(
    '/',
    handle(async (req, res) => {
      sendData(res, await service.clear(getAuth(req).userId));
    }),
  );

  return router;
}
