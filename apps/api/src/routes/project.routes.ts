import { Router, type Request } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  createProjectSchema,
  updateProjectSchema,
  projectTeamMemberSchema,
  milestoneSchema,
  projectNoteSchema,
  projectDeploymentSchema,
  uuidSchema,
} from '@clientflow/shared';
import { projectController } from '../controllers/project.controller';
import { portalController } from '../controllers/portal.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

export const projectRoutes = Router();
const idParams = z.object({ id: uuidSchema });
const teamMemberIdParams = z.object({ id: uuidSchema, userId: uuidSchema });

// Configure file upload directory
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File Type Filter
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4',
    'video/webm',
    'text/plain',
    'application/x-tar',
    'application/gzip',
    'application/x-7z-compressed',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Supported: PDF, images, Office files, ZIP/source archives, and videos.',
      ),
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max limit
});

// Apply auth middleware to all routes
projectRoutes.use(requireAuth);

// --- Projects Endpoints ---
projectRoutes.get('/', requireRole('ADMIN', 'STAFF'), (req, res, next) =>
  projectController.list(req, res).catch(next),
);

projectRoutes.post('/', requireRole('ADMIN'), validate(createProjectSchema), (req, res, next) =>
  projectController.create(req, res).catch(next),
);

projectRoutes.get(
  '/:id',
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  (req, res, next) => projectController.getById(req, res).catch(next),
);

projectRoutes.patch(
  '/:id',
  requireRole('ADMIN', 'STAFF'), // Staff members can update, but inside the controller we restrict modifying billing/owner details
  validate(idParams, 'params'),
  validate(updateProjectSchema),
  (req, res, next) => projectController.update(req, res).catch(next),
);

projectRoutes.delete('/:id', requireRole('ADMIN'), validate(idParams, 'params'), (req, res, next) =>
  projectController.remove(req, res).catch(next),
);

projectRoutes.post(
  '/:id/archive',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => projectController.archive(req, res).catch(next),
);

projectRoutes.post(
  '/:id/restore',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => projectController.restore(req, res).catch(next),
);

// --- Project member endpoints ---
projectRoutes.get(
  '/:id/members',
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  (req, res, next) => projectController.listProjectMembers(req, res).catch(next),
);

projectRoutes.post(
  '/:id/team',
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  validate(projectTeamMemberSchema),
  (req, res, next) => projectController.addTeamMember(req, res).catch(next),
);

projectRoutes.patch(
  '/:id/team/:userId',
  requireRole('ADMIN', 'STAFF'),
  validate(teamMemberIdParams, 'params'),
  validate(projectTeamMemberSchema.omit({ userId: true })),
  (req, res, next) => projectController.updateTeamMember(req, res).catch(next),
);

projectRoutes.delete(
  '/:id/team/:userId',
  requireRole('ADMIN', 'STAFF'),
  validate(teamMemberIdParams, 'params'),
  (req, res, next) => projectController.removeTeamMember(req, res).catch(next),
);

// --- Milestones Endpoints ---
projectRoutes.get(
  '/:id/milestones',
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  (req, res, next) => projectController.getMilestones(req, res).catch(next),
);

projectRoutes.post(
  '/:id/milestones',
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  validate(milestoneSchema),
  (req, res, next) => projectController.addMilestone(req, res).catch(next),
);

const milestoneIdParams = z.object({ id: uuidSchema });

projectRoutes.patch(
  '/milestones/:id',
  requireRole('ADMIN', 'STAFF'),
  validate(milestoneIdParams, 'params'),
  validate(milestoneSchema.partial()),
  (req, res, next) => projectController.updateMilestone(req, res).catch(next),
);

projectRoutes.delete(
  '/milestones/:id',
  requireRole('ADMIN', 'STAFF'),
  validate(milestoneIdParams, 'params'),
  (req, res, next) => projectController.deleteMilestone(req, res).catch(next),
);

// --- Notes Endpoints ---
projectRoutes.get(
  '/:id/notes',
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  (req, res, next) => projectController.getNotes(req, res).catch(next),
);

projectRoutes.post(
  '/:id/notes',
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  validate(projectNoteSchema),
  (req, res, next) => projectController.addNote(req, res).catch(next),
);

const noteIdParams = z.object({ id: uuidSchema });

projectRoutes.patch(
  '/notes/:id',
  requireRole('ADMIN', 'STAFF'),
  validate(noteIdParams, 'params'),
  validate(projectNoteSchema),
  (req, res, next) => projectController.updateNote(req, res).catch(next),
);

projectRoutes.delete(
  '/notes/:id',
  requireRole('ADMIN', 'STAFF'),
  validate(noteIdParams, 'params'),
  (req, res, next) => projectController.deleteNote(req, res).catch(next),
);

// --- Deployments Endpoints ---
projectRoutes.post(
  '/:id/deployments',
  requireRole('ADMIN', 'STAFF'),
  validate(idParams, 'params'),
  validate(projectDeploymentSchema),
  (req, res, next) => projectController.addDeployment(req, res).catch(next),
);

const deploymentIdParams = z.object({ id: uuidSchema });

projectRoutes.delete(
  '/deployments/:id',
  requireRole('ADMIN', 'STAFF'),
  validate(deploymentIdParams, 'params'),
  (req, res, next) => projectController.deleteDeployment(req, res).catch(next),
);

// --- Files Endpoints ---
// GET list files for a project
projectRoutes.get(
  '/:id/files',
  requireRole('ADMIN', 'STAFF', 'CLIENT'),
  validate(idParams, 'params'),
  (req, res, next) => portalController.files(req, res).catch(next),
);

// POST handles multipart form file upload
projectRoutes.post(
  '/:id/files',
  requireRole('ADMIN', 'STAFF', 'CLIENT'),
  validate(idParams, 'params'),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  (req, res, next) => portalController.uploadFile(req, res).catch(next),
);

const fileIdParams = z.object({ id: uuidSchema });

projectRoutes.delete(
  '/files/:id',
  requireRole('ADMIN', 'STAFF'),
  validate(fileIdParams, 'params'),
  (req, res, next) => portalController.deleteFile(req, res).catch(next),
);
