import bcrypt from 'bcrypt';
import type { CreateUserInput } from '../repositories/user.repository';
import { userRepository } from '../repositories/user.repository';
import { AppError, notFound } from '../utils/errors';

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
    return userRepository.create({ ...input, password });
  },

  async updateUser(id: string, data: Parameters<typeof userRepository.update>[1]) {
    const existing = await userRepository.findPublicById(id);
    if (!existing) {
      throw notFound('User not found');
    }
    if (typeof data.email === 'string' && (await userRepository.emailExists(data.email, id))) {
      throw new AppError(409, 'Email is already in use');
    }
    return userRepository.update(id, data);
  },

  async updateProfile(userId: string, data: Parameters<typeof userRepository.update>[1]) {
    return this.updateUser(userId, data);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await userRepository.findByEmailWithPassword(
      (await userRepository.findPublicById(userId))?.email ?? '',
    );
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new AppError(400, 'Current password is incorrect');
    }
    return userRepository.update(userId, { password: await bcrypt.hash(newPassword, saltRounds) });
  },

  async deleteUser(id: string) {
    const existing = await userRepository.findPublicById(id);
    if (!existing) {
      throw notFound('User not found');
    }
    return userRepository.softDelete(id);
  },
};
