import type { ApiErrorBody } from '@ecommerce/types';
import { issuesByField } from '@ecommerce/validation';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import type { Logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';
import { isRecordNotFound, isUniqueViolation } from '../utils/prisma.js';

function body(code: string, message: string, details?: Record<string, string[]>): ApiErrorBody {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}

/** Body-parser errors carry an HTTP status and a type such as `entity.parse.failed`. */
function parserErrorType(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'type' in error) {
    return typeof error.type === 'string' ? error.type : null;
  }

  return null;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(body('ROUTE_NOT_FOUND', 'The requested endpoint does not exist.'));
};

/** Maps every failure to a safe JSON error. Internal details are logged, never returned. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof AppError) {
      res.status(error.status).json(body(error.code, error.message, error.details));
      return;
    }

    if (error instanceof ZodError) {
      res
        .status(422)
        .json(body('VALIDATION_ERROR', 'Some fields are invalid.', issuesByField(error)));
      return;
    }

    const parserError = parserErrorType(error);
    if (parserError === 'entity.parse.failed') {
      res.status(400).json(body('INVALID_JSON', 'The request body is not valid JSON.'));
      return;
    }
    if (parserError === 'entity.too.large') {
      res.status(413).json(body('PAYLOAD_TOO_LARGE', 'The request body is too large.'));
      return;
    }

    if (isUniqueViolation(error)) {
      res.status(409).json(body('CONFLICT', 'The resource already exists.'));
      return;
    }

    if (isRecordNotFound(error)) {
      res.status(404).json(body('NOT_FOUND', 'The resource was not found.'));
      return;
    }

    logger.error({ err: error, method: req.method, url: req.originalUrl }, 'Unhandled error');
    res.status(500).json(body('INTERNAL_ERROR', 'Something went wrong. Please try again.'));
  };
}
