import { Router } from 'express';

import type { AppContext } from '../../context.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireCsrfHeader } from '../../middleware/csrf.js';
import { createAuthLimiter } from '../../middleware/rate-limit.js';
import { handle } from '../../utils/http.js';
import { createAuthController } from './auth.controller.js';
import { createAuthService } from './auth.service.js';

export function createAuthRouter(ctx: AppContext): Router {
  const controller = createAuthController(createAuthService(ctx), ctx.env);
  const limiter = createAuthLimiter(ctx.env);
  const authenticated = requireAuth(ctx.accessTokens);
  const router = Router();

  router.post('/register', limiter, handle(controller.register));
  router.post('/login', limiter, handle(controller.login));
  router.post('/refresh', requireCsrfHeader, handle(controller.refresh));
  router.post('/logout', requireCsrfHeader, handle(controller.logout));
  router.post('/forgot-password', limiter, handle(controller.forgotPassword));
  router.post('/reset-password', limiter, handle(controller.resetPassword));
  router.post('/verify-email', limiter, handle(controller.verifyEmail));
  router.post(
    '/verify-email/resend',
    limiter,
    authenticated,
    handle(controller.resendVerification),
  );
  router.get('/me', authenticated, handle(controller.me));
  router.patch('/me', authenticated, handle(controller.updateProfile));
  router.post('/change-password', limiter, authenticated, handle(controller.changePassword));

  return router;
}
