import bcrypt from 'bcrypt';
import type { AuthUser } from '@clientflow/types';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '@clientflow/shared';
import type { z } from 'zod';
import { userRepository } from '../repositories/user.repository';
import { tokenRepository } from '../repositories/token.repository';
import { AppError, unauthorized } from '../utils/errors';
import { createOpaqueToken, hashToken, signAccessToken } from '../utils/tokens';
import { logger } from '../utils/logger';

const resetTokenMinutes = 30;

function toAuthUser(user: Awaited<ReturnType<typeof userRepository.findByEmailWithPassword>>): AuthUser {
  if (!user) {
    throw unauthorized();
  }
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
  };
}

async function createRefreshToken(userId: string, rememberMe: boolean) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000);
  await tokenRepository.createRefresh(userId, hashToken(token), expiresAt);
  return token;
}

export const authService = {
  async login(input: z.infer<typeof loginSchema>) {
    const user = await userRepository.findByEmailWithPassword(input.email);
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      throw unauthorized('Invalid credentials');
    }

    const valid = await bcrypt.compare(input.password, user.password);
    if (!valid) {
      throw unauthorized('Invalid credentials');
    }

    await userRepository.touchLogin(user.id);
    const authUser = toAuthUser(user);
    const accessToken = signAccessToken(authUser);
    const refreshToken = await createRefreshToken(user.id, input.rememberMe);
    logger.info({ userId: user.id }, 'User authenticated');
    return { user: authUser, accessToken, refreshToken };
  },

  async refresh(refreshToken: string) {
    const currentHash = hashToken(refreshToken);
    const record = await tokenRepository.findRefresh(currentHash);
    if (!record || record.revokedAt || record.expiresAt < new Date() || record.user.deletedAt) {
      throw unauthorized('Invalid refresh token');
    }

    const authUser = toAuthUser(record.user);
    const nextRefreshToken = await createRefreshToken(record.userId, true);
    await tokenRepository.revokeRefresh(currentHash, hashToken(nextRefreshToken));
    return {
      user: authUser,
      accessToken: signAccessToken(authUser),
      refreshToken: nextRefreshToken,
    };
  },

  async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      await tokenRepository.revokeRefresh(hashToken(refreshToken)).catch(() => undefined);
      return;
    }
    if (userId) {
      await tokenRepository.revokeAllForUser(userId);
    }
  },

  async forgotPassword(input: z.infer<typeof forgotPasswordSchema>) {
    const user = await userRepository.findByEmailWithPassword(input.email);
    if (!user) {
      return { resetToken: undefined };
    }
    const resetToken = createOpaqueToken();
    await tokenRepository.createReset(
      user.id,
      hashToken(resetToken),
      new Date(Date.now() + resetTokenMinutes * 60 * 1000),
    );
    logger.info({ userId: user.id }, 'Password reset requested');
    return { resetToken };
  },

  async resetPassword(input: z.infer<typeof resetPasswordSchema>) {
    const tokenHash = hashToken(input.token);
    const record = await tokenRepository.findReset(tokenHash);
    if (!record || record.usedAt || record.expiresAt < new Date() || record.user.deletedAt) {
      throw new AppError(400, 'Invalid or expired reset token');
    }
    await userRepository.update(record.userId, { password: await bcrypt.hash(input.password, 12) });
    await tokenRepository.markResetUsed(tokenHash);
    await tokenRepository.revokeAllForUser(record.userId);
  },
};
