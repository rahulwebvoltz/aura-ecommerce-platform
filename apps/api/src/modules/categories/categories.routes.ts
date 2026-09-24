import { slugParamsSchema } from '@ecommerce/validation';
import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { handle, sendData } from '../../utils/http.js';
import { createCategoriesService } from './categories.service.js';

export function createCategoriesRouter(ctx: AppContext): Router {
  const service = createCategoriesService(ctx.prisma);
  const router = Router();

  router.get(
    '/',
    handle(async (_req, res) => {
      sendData(res, await service.tree());
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
