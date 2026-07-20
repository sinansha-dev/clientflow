import bcrypt from 'bcrypt';
import type { CreateUserInput } from '../repositories/user.repository';
import { userRepository } from '../repositories/user.repository';
import { AppError, notFound } from '../utils/errors';
import { notificationService, NotificationEvents } from './notification.service';
import { logger } from '../utils/logger';

const saltRounds = 12;

export const userService = {
  listUsers() {
    return userRepository.list();
  },

  listStaffOptions() {
    return userRepository.listStaff();
  },

  async createUser(input: CreateUserInput) {
    if (await userRepository.emailExists(input.email)) {
      throw new AppError(409, 'Email is already in use');
    }
    const password = await bcrypt.hash(input.password, saltRounds);
    const createdUser = await userRepository.create({ ...input, password });

    // Trigger Welcome Email Notification
    await notificationService
      .notifyEvent(
        NotificationEvents.AUTH_WELCOME,
        [createdUser.id],
        {
          recipientName: `${createdUser.firstName} ${createdUser.lastName}`,
          userEmail: createdUser.email,
          role: createdUser.role,
        },
        { sendEmail: true },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch welcome notification'));

    return createdUser;
  },

  async updateUser(id: string, data: Parameters<typeof userRepository.update>[1]) {
    const existing = await userRepository.findPublicById(id);
    if (!existing) {
      throw notFound('User not found');
    }
    if (typeof data.email === 'string' && (await userRepository.emailExists(data.email, id))) {
      throw new AppError(409, 'Email is already in use');
    }

    const isEmailChanging =
      typeof data.email === 'string' && data.email.toLowerCase() !== existing.email.toLowerCase();
    const updated = await userRepository.update(id, data);

    if (isEmailChanging && typeof data.email === 'string') {
      const newEmail: string = data.email;
      // Notify both old and new emails about email change
      await notificationService
        .notifyEvent(
          NotificationEvents.AUTH_EMAIL_CHANGED,
          [existing.email, newEmail],
          {
            recipientName: `${updated.firstName} ${updated.lastName}`,
            userEmail: newEmail,
          },
          { sendEmail: true, priority: 'HIGH' },
        )
        .catch((err) => logger.error({ err }, 'Failed to dispatch email changed notification'));
    }

    return updated;
  },

  async updateProfile(userId: string, data: Parameters<typeof userRepository.update>[1]) {
    return this.updateUser(userId, data);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const existingUser = await userRepository.findPublicById(userId);
    if (!existingUser) {
      throw notFound('User not found');
    }

    const user = await userRepository.findByEmailWithPassword(existingUser.email);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new AppError(400, 'Current password is incorrect');
    }

    const result = await userRepository.update(userId, {
      password: await bcrypt.hash(newPassword, saltRounds),
    });

    // Trigger Password Changed Notification
    await notificationService
      .notifyEvent(
        NotificationEvents.AUTH_PASSWORD_CHANGED,
        [userId],
        {
          recipientName: `${user.firstName} ${user.lastName}`,
          userEmail: user.email,
        },
        { sendEmail: true, priority: 'HIGH' },
      )
      .catch((err) => logger.error({ err }, 'Failed to dispatch password changed notification'));

    return result;
  },

  async deleteUser(id: string) {
    const existing = await userRepository.findPublicById(id);
    if (!existing) {
      throw notFound('User not found');
    }
    return userRepository.softDelete(id);
  },
};
