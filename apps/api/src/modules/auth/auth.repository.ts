import type { DatabaseClient, RefreshToken, User, UserTokenType } from '@ecommerce/db';

interface NewRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<User>;
  updateUser(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      passwordHash?: string;
      emailVerified?: boolean;
    },
  ): Promise<User>;
  createRefreshToken(data: NewRefreshToken): Promise<{ id: string }>;
  findRefreshToken(tokenHash: string): Promise<(RefreshToken & { user: User }) | null>;
  rotateRefreshToken(currentId: string, next: NewRefreshToken, now: Date): Promise<boolean>;
  revokeTokenFamily(familyId: string, now: Date): Promise<{ count: number }>;
  revokeRefreshToken(tokenHash: string, now: Date): Promise<{ count: number }>;
  revokeAllUserTokens(userId: string, now: Date): Promise<{ count: number }>;
  replaceUserToken(data: {
    userId: string;
    type: UserTokenType;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeUserToken(tokenHash: string, type: UserTokenType, now: Date): Promise<string | null>;
}

/** Data access for identity records. Keeps Prisma query shapes out of the auth service. */
export function createAuthRepository(prisma: DatabaseClient): AuthRepository {
  return {
    findUserByEmail(email: string): Promise<User | null> {
      return prisma.user.findUnique({ where: { email } });
    },

    findUserById(id: string): Promise<User | null> {
      return prisma.user.findUnique({ where: { id } });
    },

    createUser(data: {
      email: string;
      passwordHash: string;
      firstName: string;
      lastName: string;
    }): Promise<User> {
      return prisma.user.create({ data });
    },

    updateUser(
      id: string,
      data: {
        firstName?: string;
        lastName?: string;
        phone?: string | null;
        passwordHash?: string;
        emailVerified?: boolean;
      },
    ): Promise<User> {
      return prisma.user.update({ where: { id }, data });
    },

    createRefreshToken(data) {
      return prisma.refreshToken.create({ data, select: { id: true } });
    },

    findRefreshToken(tokenHash: string) {
      return prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    },

    /** Atomically rotates a refresh token. Returns false if it was already used concurrently. */
    rotateRefreshToken(currentId: string, next: NewRefreshToken, now: Date): Promise<boolean> {
      return prisma.$transaction(async (tx) => {
        const revoked = await tx.refreshToken.updateMany({
          where: { id: currentId, revokedAt: null },
          data: { revokedAt: now },
        });
        if (revoked.count === 0) {
          return false;
        }

        const created = await tx.refreshToken.create({ data: next, select: { id: true } });
        await tx.refreshToken.update({
          where: { id: currentId },
          data: { replacedById: created.id },
        });
        return true;
      });
    },

    revokeTokenFamily(familyId: string, now: Date) {
      return prisma.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: now },
      });
    },

    revokeRefreshToken(tokenHash: string, now: Date) {
      return prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now },
      });
    },

    revokeAllUserTokens(userId: string, now: Date) {
      return prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    },

    /** Replaces any outstanding token of the same type with a fresh one. */
    async replaceUserToken(data: {
      userId: string;
      type: UserTokenType;
      tokenHash: string;
      expiresAt: Date;
    }): Promise<void> {
      await prisma.$transaction([
        prisma.userToken.deleteMany({
          where: { userId: data.userId, type: data.type, usedAt: null },
        }),
        prisma.userToken.create({ data }),
      ]);
    },

    /** Marks a valid, unused token as used and returns its user id, or null if unusable. */
    async consumeUserToken(
      tokenHash: string,
      type: UserTokenType,
      now: Date,
    ): Promise<string | null> {
      const token = await prisma.userToken.findUnique({ where: { tokenHash } });
      if (token?.type !== type || token.usedAt !== null || token.expiresAt <= now) {
        return null;
      }

      const consumed = await prisma.userToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: now },
      });
      return consumed.count === 1 ? token.userId : null;
    },
  };
}
