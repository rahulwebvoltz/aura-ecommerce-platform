import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

import type { Logger } from '../config/logger.js';

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/u;

/** Adds an `x-request-id` and logs one line per completed request. */
export function requestLog(logger: Logger, ignorePaths: readonly string[] = []): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    const requestId = incoming !== undefined && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', requestId);

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      if (ignorePaths.includes(req.path)) {
        return;
      }

      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const fields = {
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
      };
      if (res.statusCode >= 500) {
        logger.error(fields, 'request failed');
      } else {
        logger.info(fields, 'request completed');
      }
    });
    next();
  };
}
