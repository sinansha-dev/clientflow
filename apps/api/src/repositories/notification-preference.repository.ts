import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface UpsertPreferenceInput {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  pushEnabled?: boolean;
  smsEnabled?: boolean;
  language?: string;
  timezone?: string;
}

export const notificationPreferenceRepository = {
  async getByUserId(userId: string) {
    return prisma.notificationPreference.findUnique({
      where: { userId },
    });
  },

  async upsertPreference(userId: string, input: UpsertPreferenceInput) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        emailEnabled: input.emailEnabled ?? true,
        inAppEnabled: input.inAppEnabled ?? true,
        pushEnabled: input.pushEnabled ?? true,
        smsEnabled: input.smsEnabled ?? false,
        language: input.language ?? 'en',
        timezone: input.timezone ?? 'UTC',
      },
      update: {
        ...(typeof input.emailEnabled === 'boolean' ? { emailEnabled: input.emailEnabled } : {}),
        ...(typeof input.inAppEnabled === 'boolean' ? { inAppEnabled: input.inAppEnabled } : {}),
        ...(typeof input.pushEnabled === 'boolean' ? { pushEnabled: input.pushEnabled } : {}),
        ...(typeof input.smsEnabled === 'boolean' ? { smsEnabled: input.smsEnabled } : {}),
        ...(input.language ? { language: input.language } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
      },
    });
  },
};
