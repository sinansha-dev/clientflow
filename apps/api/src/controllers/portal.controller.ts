import type { Request, Response } from 'express';
import { portalService } from '../services/portal.service';
import { ok } from '../utils/http';

export const portalController = {
  async dashboard(req: Request, res: Response) {
    return ok(res, 'Portal dashboard loaded', await portalService.dashboard(req.user));
  },

  async projects(req: Request, res: Response) {
    return ok(res, 'Portal projects loaded', { projects: await portalService.projects(req.user) });
  },

  async project(req: Request, res: Response) {
    return ok(res, 'Portal project loaded', {
      project: await portalService.project(req.params.id!, req.user),
    });
  },

  async meetings(req: Request, res: Response) {
    return ok(res, 'Portal meetings loaded', { meetings: await portalService.meetings(req.user) });
  },

  async files(req: Request, res: Response) {
    return ok(res, 'Files loaded', { files: await portalService.files(req.params.id!, req.user) });
  },

  async uploadFile(req: Request, res: Response) {
    const file = await portalService.uploadFile(req.params.id!, req.user, req.file, req.body);
    return ok(res, 'File uploaded', { file }, 201);
  },

  async updateFile(req: Request, res: Response) {
    const file = await portalService.updateFile(req.params.id!, req.user, req.body);
    return ok(res, 'File updated', { file });
  },

  async deleteFile(req: Request, res: Response) {
    await portalService.deleteFile(req.params.id!, req.user);
    return ok(res, 'File deleted');
  },

  async downloadFile(req: Request, res: Response) {
    return ok(res, 'Download prepared', await portalService.download(req.params.id!, req.user));
  },

  async folders(req: Request, res: Response) {
    return ok(res, 'Folders loaded', {
      folders: await portalService.folders(String(req.query.projectId), req.user),
    });
  },

  async createFolder(req: Request, res: Response) {
    return ok(
      res,
      'Folder created',
      { folder: await portalService.createFolder(req.user, req.body) },
      201,
    );
  },

  async updateFolder(req: Request, res: Response) {
    return ok(res, 'Folder updated', {
      folder: await portalService.updateFolder(req.params.id!, req.user, req.body),
    });
  },

  async deleteFolder(req: Request, res: Response) {
    await portalService.deleteFolder(req.params.id!, req.user);
    return ok(res, 'Folder deleted');
  },

  async approvals(req: Request, res: Response) {
    return ok(res, 'Approvals loaded', {
      approvals: await portalService.approvals(
        req.user,
        req.query.projectId ? String(req.query.projectId) : undefined,
      ),
    });
  },

  async approve(req: Request, res: Response) {
    return ok(res, 'Deliverable approved', {
      approval: await portalService.approve(req.params.id!, req.user, req.body.comments),
    });
  },

  async requestRevision(req: Request, res: Response) {
    return ok(res, 'Revision requested', {
      revision: await portalService.requestRevision(
        req.params.id!,
        req.user,
        req.body.description,
        req.body.priority,
      ),
    });
  },

  async revisions(req: Request, res: Response) {
    return ok(res, 'Revisions loaded', {
      revisions: await portalService.revisions(
        req.user,
        req.query.projectId ? String(req.query.projectId) : undefined,
      ),
    });
  },

  async createRevision(req: Request, res: Response) {
    return ok(
      res,
      'Revision created',
      { revision: await portalService.createRevision(req.user, req.body) },
      201,
    );
  },

  async updateRevision(req: Request, res: Response) {
    return ok(res, 'Revision updated', {
      revision: await portalService.updateRevision(req.params.id!, req.user, req.body),
    });
  },

  async messages(req: Request, res: Response) {
    return ok(res, 'Messages loaded', {
      messages: await portalService.messages(String(req.query.projectId), req.user),
    });
  },

  async createMessage(req: Request, res: Response) {
    return ok(
      res,
      'Message sent',
      { message: await portalService.createMessage(req.user, req.body) },
      201,
    );
  },

  async updateMessage(req: Request, res: Response) {
    return ok(res, 'Message updated', {
      message: await portalService.updateMessage(req.params.id!, req.user, req.body.body),
    });
  },

  async deleteMessage(req: Request, res: Response) {
    await portalService.deleteMessage(req.params.id!, req.user);
    return ok(res, 'Message deleted');
  },
};
