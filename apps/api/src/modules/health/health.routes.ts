import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { handle, sendData } from '../../utils/http.js';

export function createHealthRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    handle(async (_req, res) => {
      try {
        await ctx.prisma.$queryRaw`SELECT 1`;
        sendData(res, { status: 'ok', database: 'ok' });
      } catch (error) {
        ctx.logger.error({ err: error }, 'Health check failed');
        res.status(503).json({ data: { status: 'degraded', database: 'unavailable' } });
      }
    }),
  );

  return router;
}
