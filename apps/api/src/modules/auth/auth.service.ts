import { randomUUID } from 'node:crypto';

import type { User } from '@ecommerce/db';
import type { AuthSessionDto, UserDto } from '@ecommerce/types';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '@ecommerce/validation';
import argon2 from 'argon2';

import type { AppContext } from '../../context.js';
import { generateToken, sha256 } from '../../utils/crypto.js';
import { badRequest, conflict, unauthorized } from '../../utils/errors.js';
import { toUserDto } from './auth.mapper.js';
import { createAuthRepository } from './auth.repository.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const VERIFY_EMAIL_TTL = DAY;
const RESET_PASSWORD_TTL = HOUR;

const HASH_OPTIONS = { type: argon2.argon2id } as const;

// Verifying against a real hash for unknown emails keeps login timing uniform. Computed lazily,
// once per process, so creating the service never leaves native work running in the background.
let dummyHash: Promise<string> | undefined;
function timingSafeDummyHash(): Promise<string> {
  dummyHash ??= argon2.hash(generateToken(), HASH_OPTIONS);
  return dummyHash;
}

export interface IssuedSession {
  session: AuthSessionDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface ClientMeta {
  userAgent: string | null;
}

export function createAuthService(ctx: AppContext) {
  const repo = createAuthRepository(ctx.prisma);

  function refreshExpiry(): Date {
    return new Date(ctx.now().getTime() + ctx.env.REFRESH_TOKEN_TTL_DAYS * DAY);
  }

  function sessionFor(user: User): AuthSessionDto {
    return {
      user: toUserDto(user),
      accessToken: ctx.accessTokens.sign({ userId: user.id, role: user.role }),
      expiresIn: ctx.accessTokens.ttlSeconds,
    };
  }

  async function issueSession(user: User, meta: ClientMeta): Promise<IssuedSession> {
    const refreshToken = generateToken(48);
    const refreshExpiresAt = refreshExpiry();
    await repo.createRefreshToken({
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiresAt,
      userAgent: meta.userAgent,
    });

    return { session: sessionFor(user), refreshToken, refreshExpiresAt };
  }

  async function sendVerificationEmail(user: User): Promise<void> {
    const token = generateToken();
    await repo.replaceUserToken({
      userId: user.id,
      type: 'EMAIL_VERIFICATION',
      tokenHash: sha256(token),
      expiresAt: new Date(ctx.now().getTime() + VERIFY_EMAIL_TTL),
    });
    await ctx.mailer.send({
      to: user.email,
      subject: 'Verify your email address',
      text: `Hi ${user.firstName},\n\nConfirm your email address: ${ctx.env.APP_URL}/verify-email?token=${token}\n\nThis link expires in 24 hours.`,
    });
  }

  async function requireUser(userId: string): Promise<User> {
    const user = await repo.findUserById(userId);
    if (user === null) {
      throw unauthorized();
    }

    return user;
  }

  return {
    async register(input: RegisterInput, meta: ClientMeta): Promise<IssuedSession> {
      if ((await repo.findUserByEmail(input.email)) !== null) {
        throw conflict('EMAIL_IN_USE', 'An account with this email already exists.', {
          email: ['An account with this email already exists.'],
        });
      }

      const user = await repo.createUser({
        email: input.email,
        passwordHash: await argon2.hash(input.password, HASH_OPTIONS),
        firstName: input.firstName,
        lastName: input.lastName,
      });
      await sendVerificationEmail(user);

      return issueSession(user, meta);
    },

    async login(input: LoginInput, meta: ClientMeta): Promise<IssuedSession> {
      const user = await repo.findUserByEmail(input.email);
      const valid = await argon2.verify(
        user?.passwordHash ?? (await timingSafeDummyHash()),
        input.password,
      );
      if (user === null || !valid) {
        throw unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
      }

      return issueSession(user, meta);
    },

    /** Rotates a refresh token. Reusing a rotated token revokes every session in its family. */
    async refresh(rawToken: string | undefined, meta: ClientMeta): Promise<IssuedSession> {
      if (rawToken === undefined || rawToken === '') {
        throw unauthorized('Your session has expired.', 'SESSION_EXPIRED');
      }

      const now = ctx.now();
      const existing = await repo.findRefreshToken(sha256(rawToken));
      if (existing === null || existing.expiresAt <= now) {
        throw unauthorized('Your session has expired.', 'SESSION_EXPIRED');
      }

      const reuse = () => {
        ctx.logger.warn({ userId: existing.userId }, 'Refresh token reuse detected');
        return repo.revokeTokenFamily(existing.familyId, now);
      };

      if (existing.revokedAt !== null) {
        await reuse();
        throw unauthorized('Your session is no longer valid.', 'SESSION_REVOKED');
      }

      const refreshToken = generateToken(48);
      const refreshExpiresAt = refreshExpiry();
      const rotated = await repo.rotateRefreshToken(
        existing.id,
        {
          userId: existing.userId,
          familyId: existing.familyId,
          tokenHash: sha256(refreshToken),
          expiresAt: refreshExpiresAt,
          userAgent: meta.userAgent,
        },
        now,
      );
      if (!rotated) {
        await reuse();
        throw unauthorized('Your session is no longer valid.', 'SESSION_REVOKED');
      }

      return { session: sessionFor(existing.user), refreshToken, refreshExpiresAt };
    },

    async logout(rawToken: string | undefined): Promise<void> {
      if (rawToken !== undefined && rawToken !== '') {
        await repo.revokeRefreshToken(sha256(rawToken), ctx.now());
      }
    },

    /** Always resolves so the response never reveals whether an email is registered. */
    async forgotPassword(email: string): Promise<void> {
      const user = await repo.findUserByEmail(email);
      if (user === null) {
        return;
      }

      const token = generateToken();
      await repo.replaceUserToken({
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: sha256(token),
        expiresAt: new Date(ctx.now().getTime() + RESET_PASSWORD_TTL),
      });
      await ctx.mailer.send({
        to: user.email,
        subject: 'Reset your password',
        text: `Hi ${user.firstName},\n\nReset your password: ${ctx.env.APP_URL}/reset-password?token=${token}\n\nThis link expires in 1 hour. If you did not request it, you can ignore this email.`,
      });
    },

    async resetPassword(input: ResetPasswordInput): Promise<void> {
      const now = ctx.now();
      const userId = await repo.consumeUserToken(sha256(input.token), 'PASSWORD_RESET', now);
      if (userId === null) {
        throw badRequest('INVALID_TOKEN', 'This reset link is invalid or has expired.');
      }

      await repo.updateUser(userId, {
        passwordHash: await argon2.hash(input.password, HASH_OPTIONS),
      });
      await repo.revokeAllUserTokens(userId, now);
    },

    async verifyEmail(token: string): Promise<UserDto> {
      const userId = await repo.consumeUserToken(sha256(token), 'EMAIL_VERIFICATION', ctx.now());
      if (userId === null) {
        throw badRequest('INVALID_TOKEN', 'This verification link is invalid or has expired.');
      }

      return toUserDto(await repo.updateUser(userId, { emailVerified: true }));
    },

    async resendVerification(userId: string): Promise<void> {
      const user = await requireUser(userId);
      if (user.emailVerified) {
        throw conflict('ALREADY_VERIFIED', 'Your email address is already verified.');
      }

      await sendVerificationEmail(user);
    },

    async me(userId: string): Promise<UserDto> {
      return toUserDto(await requireUser(userId));
    },

    async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserDto> {
      await requireUser(userId);
      const data: { firstName?: string; lastName?: string; phone?: string | null } = {};
      if (input.firstName !== undefined) data.firstName = input.firstName;
      if (input.lastName !== undefined) data.lastName = input.lastName;
      if (input.phone !== undefined) data.phone = input.phone;

      return toUserDto(await repo.updateUser(userId, data));
    },

    /** Changes the password, signs out every other session, and returns a fresh session. */
    async changePassword(
      userId: string,
      input: ChangePasswordInput,
      meta: ClientMeta,
    ): Promise<IssuedSession> {
      const user = await requireUser(userId);
      if (!(await argon2.verify(user.passwordHash, input.currentPassword))) {
        throw badRequest('INVALID_PASSWORD', 'Your current password is incorrect.', {
          currentPassword: ['Your current password is incorrect.'],
        });
      }

      const updated = await repo.updateUser(userId, {
        passwordHash: await argon2.hash(input.newPassword, HASH_OPTIONS),
      });
      await repo.revokeAllUserTokens(userId, ctx.now());

      return issueSession(updated, meta);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
