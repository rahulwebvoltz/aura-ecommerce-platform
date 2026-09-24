import { addressSchema, idParamsSchema, updateAddressSchema } from '@ecommerce/validation';
import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { handle, sendData } from '../../utils/http.js';
import { createAddressesService } from './addresses.service.js';

export function createAddressesRouter(ctx: AppContext): Router {
  const service = createAddressesService(ctx);
  const router = Router();
  router.use(requireAuth(ctx.accessTokens));

  router.get(
    '/',
    handle(async (req, res) => {
      sendData(res, await service.list(getAuth(req).userId));
    }),
  );

  router.post(
    '/',
    handle(async (req, res) => {
      const input = addressSchema.parse(req.body);
      sendData(res, await service.create(getAuth(req).userId, input), 201);
    }),
  );

  router.get(
    '/:id',
    handle(async (req, res) => {
      const { id } = idParamsSchema.parse(req.params);
      sendData(res, await service.get(getAuth(req).userId, id));
    }),
  );

  router.patch(
    '/:id',
    handle(async (req, res) => {
      const { id } = idParamsSchema.parse(req.params);
      const input = updateAddressSchema.parse(req.body);
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
