import { prisma } from '../config/prisma';

export const tokenRepository = {
  createRefresh(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  },

  findRefresh(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  },

  revokeRefresh(tokenHash: string, replacedByTokenHash?: string) {
    return prisma.refreshToken.update({
      where: { tokenHash },
      data: {
        revokedAt: new Date(),
        ...(replacedByTokenHash ? { replacedByTokenHash } : {}),
      },
    });
  },

  revokeAllForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  createReset(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  },

  findReset(tokenHash: string) {
    return prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
  },

  markResetUsed(tokenHash: string) {
    return prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    });
  },
};
