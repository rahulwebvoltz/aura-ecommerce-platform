import { USER_ROLES, type UserRole } from '@ecommerce/shared';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const ISSUER = 'ecommerce-api';
const AUDIENCE = 'ecommerce-web';

const payloadSchema = z.object({
  sub: z.uuid(),
  role: z.enum(USER_ROLES),
});

export interface AccessTokenClaims {
  userId: string;
  role: UserRole;
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): string;
  /** Returns the claims, or null for any invalid, expired, or tampered token. */
  verify(token: string): AccessTokenClaims | null;
  readonly ttlSeconds: number;
}

export function createAccessTokenService(secret: string, ttlSeconds: number): AccessTokenService {
  return {
    ttlSeconds,
    sign({ userId, role }) {
      return jwt.sign({ role }, secret, {
        algorithm: 'HS256',
        audience: AUDIENCE,
        expiresIn: ttlSeconds,
        issuer: ISSUER,
        subject: userId,
      });
    },
    verify(token) {
      try {
        const decoded = jwt.verify(token, secret, {
          algorithms: ['HS256'],
          audience: AUDIENCE,
          issuer: ISSUER,
        });
        const parsed = payloadSchema.safeParse(decoded);
        return parsed.success ? { userId: parsed.data.sub, role: parsed.data.role } : null;
      } catch {
        return null;
      }
    },
  };
}
