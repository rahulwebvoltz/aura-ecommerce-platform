import type { MessageDto } from '@ecommerce/types';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '@ecommerce/validation';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';

import type { Env } from '../../config/env.js';
import { getAuth } from '../../middleware/auth.js';
import { sendData } from '../../utils/http.js';
import type { AuthService, ClientMeta, IssuedSession } from './auth.service.js';

export const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';

const cookiesSchema = z.object({ [REFRESH_COOKIE]: z.string().optional() });

function clientMeta(req: Request): ClientMeta {
  return { userAgent: req.get('user-agent')?.slice(0, 255) ?? null };
}

function readRefreshCookie(req: Request): string | undefined {
  const parsed = cookiesSchema.safeParse(req.cookies);
  return parsed.success ? parsed.data[REFRESH_COOKIE] : undefined;
}

export function createAuthController(service: AuthService, env: Env) {
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };

  function sendSession(res: Response, issued: IssuedSession, status = 200): void {
    res.cookie(REFRESH_COOKIE, issued.refreshToken, {
      ...cookieOptions,
      expires: issued.refreshExpiresAt,
    });
    res.setHeader('Cache-Control', 'no-store');
    sendData(res, issued.session, status);
  }

  const message = (text: string): MessageDto => ({ message: text });

  return {
    register: async (req: Request, res: Response): Promise<void> => {
      const input = registerSchema.parse(req.body);
      sendSession(res, await service.register(input, clientMeta(req)), 201);
    },

    login: async (req: Request, res: Response): Promise<void> => {
      const input = loginSchema.parse(req.body);
      sendSession(res, await service.login(input, clientMeta(req)));
    },

    refresh: async (req: Request, res: Response): Promise<void> => {
      try {
        sendSession(res, await service.refresh(readRefreshCookie(req), clientMeta(req)));
      } catch (error) {
        res.clearCookie(REFRESH_COOKIE, cookieOptions);
        throw error;
      }
    },

    logout: async (req: Request, res: Response): Promise<void> => {
      await service.logout(readRefreshCookie(req));
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      res.status(204).end();
    },

    forgotPassword: async (req: Request, res: Response): Promise<void> => {
      const { email } = forgotPasswordSchema.parse(req.body);
      await service.forgotPassword(email);
      sendData(res, message('If an account exists for that email, a reset link is on its way.'));
    },

    resetPassword: async (req: Request, res: Response): Promise<void> => {
      await service.resetPassword(resetPasswordSchema.parse(req.body));
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      sendData(res, message('Your password has been reset. Please sign in.'));
    },

    verifyEmail: async (req: Request, res: Response): Promise<void> => {
      const { token } = verifyEmailSchema.parse(req.body);
      sendData(res, await service.verifyEmail(token));
    },

    resendVerification: async (req: Request, res: Response): Promise<void> => {
      await service.resendVerification(getAuth(req).userId);
      sendData(res, message('A new verification link has been sent.'));
    },

    me: async (req: Request, res: Response): Promise<void> => {
      sendData(res, await service.me(getAuth(req).userId));
    },

    updateProfile: async (req: Request, res: Response): Promise<void> => {
      const input = updateProfileSchema.parse(req.body);
      sendData(res, await service.updateProfile(getAuth(req).userId, input));
    },

    changePassword: async (req: Request, res: Response): Promise<void> => {
      const input = changePasswordSchema.parse(req.body);
      sendSession(res, await service.changePassword(getAuth(req).userId, input, clientMeta(req)));
    },
  };
}
