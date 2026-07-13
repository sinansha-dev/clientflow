import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { portalRepository } from '../repositories/portal.repository';
import { ok } from '../utils/http';

export const searchController = {
  async search(req: Request, res: Response) {
    const user = req.user!;
    const q = (req.query.q as string) || '';

    if (!q.trim()) {
      return ok(res, 'Search completed', {
        projects: [],
        tasks: [],
        clients: [],
        team: [],
      });
    }

    const projectsWhere = portalRepository.projectAccessWhere(user.id, user.email, user.role);

    // 1. Projects search
    const projects = await prisma.project.findMany({
      where: {
        ...projectsWhere,
        OR: [
          { projectName: { contains: q, mode: 'insensitive' } },
          { projectCode: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        projectName: true,
        projectCode: true,
      },
      take: 5,
    });

    // 2. Tasks search
    // CLIENT role can only see tasks that are part of projects they can access AND status: 'COMPLETED'
    // ADMIN and DEVELOPER can see any tasks in projects they can access
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        project: projectsWhere,
        title: { contains: q, mode: 'insensitive' },
        ...(user.role === 'CLIENT' ? { status: 'COMPLETED' } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        projectId: true,
        project: {
          select: {
            projectName: true,
          },
        },
      },
      take: 5,
    });

    let clients: any[] = [];
    let team: any[] = [];

    // Low access check: CLIENT role cannot access clients list or team list.
    if (user.role !== 'CLIENT') {
      // 3. Clients search
      clients = await prisma.client.findMany({
        where: {
          deletedAt: null,
          OR: [
            { companyName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          companyName: true,
          email: true,
        },
        take: 5,
      });

      // 4. Team members search
      team = await prisma.user.findMany({
        where: {
          deletedAt: null,
          role: { in: ['ADMIN', 'STAFF'] },
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
        take: 5,
      });
    }

    return ok(res, 'Search completed', {
      projects,
      tasks,
      clients,
      team,
    });
  },
};
