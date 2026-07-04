import type { Prisma, Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

const publicSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
  phone: true,
  role: true,
  status: true,
  emailVerified: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userRepository = {
  publicSelect,

  findByEmailWithPassword(email: string) {
    return prisma.user.findFirst({ where: { email, deletedAt: null } });
  },

  findActiveById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null, status: 'ACTIVE' },
      select: publicSelect,
    });
  },

  findPublicById(id: string) {
    return prisma.user.findFirst({ where: { id, deletedAt: null }, select: publicSelect });
  },

  list() {
    return prisma.user.findMany({
      where: { deletedAt: null },
      select: publicSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data, select: publicSelect });
  },

  update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data, select: publicSelect });
  },

  softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'SUSPENDED' },
      select: publicSelect,
    });
  },

  touchLogin(id: string) {
    return prisma.user.update({ where: { id }, data: { lastLogin: new Date() } });
  },

  async emailExists(email: string, exceptId?: string) {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, id: exceptId ? { not: exceptId } : undefined },
      select: { id: true },
    });
    return Boolean(user);
  },
};

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  status: UserStatus;
  phone?: string;
  avatar?: string;
};
