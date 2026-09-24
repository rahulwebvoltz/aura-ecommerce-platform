import type { Paginated } from '@ecommerce/types';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Adapts an async controller to Express, forwarding rejections to the error handler. */
export function handle(controller: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    controller(req, res).catch(next);
  };
}

export function sendData(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data });
}

export function sendPage(res: Response, page: Paginated<unknown>): void {
  res.status(200).json(page);
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return {
    data: items,
    meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
}
