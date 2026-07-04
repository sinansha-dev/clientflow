import type { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { ok } from '../utils/http';

export const userController = {
  async me(req: Request, res: Response) {
    return ok(res, 'Current user', { user: req.user });
  },

  async updateProfile(req: Request, res: Response) {
    const user = await userService.updateProfile(req.user!.id, req.body);
    return ok(res, 'Profile updated', { user });
  },

  async changePassword(req: Request, res: Response) {
    await userService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    return ok(res, 'Password updated');
  },

  async list(req: Request, res: Response) {
    return ok(res, 'Users loaded', { users: await userService.listUsers() });
  },

  async create(req: Request, res: Response) {
    const user = await userService.createUser(req.body);
    return ok(res, 'User created', { user }, 201);
  },

  async update(req: Request, res: Response) {
    const user = await userService.updateUser(req.params.id, req.body);
    return ok(res, 'User updated', { user });
  },

  async remove(req: Request, res: Response) {
    await userService.deleteUser(req.params.id);
    return ok(res, 'User deleted');
  },
};
