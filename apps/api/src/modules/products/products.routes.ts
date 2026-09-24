import { productQuerySchema, slugParamsSchema } from '@ecommerce/validation';
import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { handle, sendData, sendPage } from '../../utils/http.js';
import { createProductsService } from './products.service.js';

export function createProductsRouter(ctx: AppContext): Router {
  const service = createProductsService(ctx);
  const router = Router();

  router.get(
    '/',
    handle(async (req, res) => {
      sendPage(res, await service.list(productQuerySchema.parse(req.query)));
    }),
  );

  // Declared before `/:slug` so "facets" is never treated as a product slug.
  router.get(
    '/facets',
    handle(async (req, res) => {
      sendData(res, await service.facets(productQuerySchema.parse(req.query)));
    }),
  );

  router.get(
    '/:slug',
    handle(async (req, res) => {
      const { slug } = slugParamsSchema.parse(req.params);
      sendData(res, await service.bySlug(slug));
    }),
  );

  router.get(
    '/:slug/related',
    handle(async (req, res) => {
      const { slug } = slugParamsSchema.parse(req.params);
      sendData(res, await service.related(slug));
    }),
  );

  return router;
}
