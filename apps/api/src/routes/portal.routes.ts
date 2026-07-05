import { Router } from 'express';
import { z } from 'zod';
import {
  portalFolderSchema,
  portalFileUpdateSchema,
  approvalDecisionSchema,
  revisionRequestSchema,
  revisionUpdateSchema,
  portalMessageSchema,
  portalMessageUpdateSchema,
  uuidSchema,
} from '@clientflow/shared';
import { portalController } from '../controllers/portal.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const idParams = z.object({ id: uuidSchema });
const projectQuery = z.object({ projectId: uuidSchema });
const optionalProjectQuery = z.object({ projectId: uuidSchema.optional() });

export const portalRoutes = Router();
export const fileRoutes = Router();
export const folderRoutes = Router();
export const approvalRoutes = Router();
export const revisionRoutes = Router();
export const messageRoutes = Router();

portalRoutes.use(requireAuth);
portalRoutes.get('/dashboard', (req, res, next) =>
  portalController.dashboard(req, res).catch(next),
);
portalRoutes.get('/projects', (req, res, next) => portalController.projects(req, res).catch(next));
portalRoutes.get('/projects/:id', validate(idParams, 'params'), (req, res, next) =>
  portalController.project(req, res).catch(next),
);
portalRoutes.get('/meetings', (req, res, next) => portalController.meetings(req, res).catch(next));

fileRoutes.use(requireAuth);
fileRoutes.get('/:id/download', validate(idParams, 'params'), (req, res, next) =>
  portalController.downloadFile(req, res).catch(next),
);
fileRoutes.patch(
  '/:id',
  validate(idParams, 'params'),
  validate(portalFileUpdateSchema),
  (req, res, next) => portalController.updateFile(req, res).catch(next),
);
fileRoutes.delete('/:id', validate(idParams, 'params'), (req, res, next) =>
  portalController.deleteFile(req, res).catch(next),
);

folderRoutes.use(requireAuth);
folderRoutes.get('/', validate(projectQuery, 'query'), (req, res, next) =>
  portalController.folders(req, res).catch(next),
);
folderRoutes.post('/', validate(portalFolderSchema), (req, res, next) =>
  portalController.createFolder(req, res).catch(next),
);
folderRoutes.patch(
  '/:id',
  validate(idParams, 'params'),
  validate(portalFolderSchema.partial().omit({ projectId: true })),
  (req, res, next) => portalController.updateFolder(req, res).catch(next),
);
folderRoutes.delete('/:id', validate(idParams, 'params'), (req, res, next) =>
  portalController.deleteFolder(req, res).catch(next),
);

approvalRoutes.use(requireAuth);
approvalRoutes.get('/', validate(optionalProjectQuery, 'query'), (req, res, next) =>
  portalController.approvals(req, res).catch(next),
);
approvalRoutes.post(
  '/:id/approve',
  validate(idParams, 'params'),
  validate(approvalDecisionSchema),
  (req, res, next) => portalController.approve(req, res).catch(next),
);
approvalRoutes.post(
  '/:id/request-revision',
  validate(idParams, 'params'),
  validate(revisionRequestSchema.pick({ description: true, priority: true })),
  (req, res, next) => portalController.requestRevision(req, res).catch(next),
);

revisionRoutes.use(requireAuth);
revisionRoutes.get('/', validate(optionalProjectQuery, 'query'), (req, res, next) =>
  portalController.revisions(req, res).catch(next),
);
revisionRoutes.post('/', validate(revisionRequestSchema), (req, res, next) =>
  portalController.createRevision(req, res).catch(next),
);
revisionRoutes.patch(
  '/:id',
  validate(idParams, 'params'),
  validate(revisionUpdateSchema),
  (req, res, next) => portalController.updateRevision(req, res).catch(next),
);

messageRoutes.use(requireAuth);
messageRoutes.get('/', validate(projectQuery, 'query'), (req, res, next) =>
  portalController.messages(req, res).catch(next),
);
messageRoutes.post('/', validate(portalMessageSchema), (req, res, next) =>
  portalController.createMessage(req, res).catch(next),
);
messageRoutes.patch(
  '/:id',
  validate(idParams, 'params'),
  validate(portalMessageUpdateSchema),
  (req, res, next) => portalController.updateMessage(req, res).catch(next),
);
messageRoutes.delete('/:id', validate(idParams, 'params'), (req, res, next) =>
  portalController.deleteMessage(req, res).catch(next),
);
