import type { RequestHandler } from 'express';

import { forbidden } from '../utils/errors.js';

export const CSRF_HEADER = 'x-requested-with';

/**
 * Endpoints authenticated by the refresh cookie require a custom header. Browsers cannot send it
 * cross-site without a CORS preflight, which the origin allowlist rejects.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (req.get(CSRF_HEADER) === undefined) {
    next(forbidden('Missing request header.', 'CSRF_HEADER_REQUIRED'));
    return;
  }
  next();
};
