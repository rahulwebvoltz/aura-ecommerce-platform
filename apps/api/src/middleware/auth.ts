import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { AccessTokenClaims, AccessTokenService } from '../services/access-token.js';
import { unauthorized } from '../utils/errors.js';

// Keyed by request so the authenticated identity is typed without augmenting Express globals.
const identities = new WeakMap<Request, AccessTokenClaims>();

function readBearerToken(req: Request): string | null {
  const header = req.get('authorization');
  if (header === undefined) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token !== undefined && token !== '' ? token : null;
}

/** Rejects requests without a valid access token. */
export function requireAuth(tokens: AccessTokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = readBearerToken(req);
    const claims = token === null ? null : tokens.verify(token);
    if (claims === null) {
      next(unauthorized());
      return;
    }

    identities.set(req, claims);
    next();
  };
}

/** Attaches the identity when a valid token is present, without requiring one. */
export function optionalAuth(tokens: AccessTokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = readBearerToken(req);
    const claims = token === null ? null : tokens.verify(token);
    if (claims !== null) {
      identities.set(req, claims);
    }
    next();
  };
}

/** The authenticated identity. Only call behind `requireAuth`. */
export function getAuth(req: Request): AccessTokenClaims {
  const claims = identities.get(req);
  if (claims === undefined) {
    throw unauthorized();
  }

  return claims;
}

export function getOptionalAuth(req: Request): AccessTokenClaims | null {
  return identities.get(req) ?? null;
}
