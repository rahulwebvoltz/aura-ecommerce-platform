import { slugParamsSchema } from '@ecommerce/validation';
import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { handle, sendData } from '../../utils/http.js';
import { createBrandsService } from './brands.service.js';

export function createBrandsRouter(ctx: AppContext): Router {
  const service = createBrandsService(ctx.prisma);
  const router = Router();

  router.get(
    '/',
    handle(async (_req, res) => {
      sendData(res, await service.list());
    }),
  );

  router.get(
    '/:slug',
    handle(async (req, res) => {
      const { slug } = slugParamsSchema.parse(req.params);
      sendData(res, await service.bySlug(slug));
    }),
  );

  return router;
}
