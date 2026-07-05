import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  createTaskSchema,
  updateTaskSchema,
  taskCommentSchema,
  taskChecklistSchema,
  taskLabelSchema,
  uuidSchema,
} from '@clientflow/shared';
import { taskController } from '../controllers/task.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

export const taskRoutes = Router();
export const labelRoutes = Router();

const idParams = z.object({ id: uuidSchema });

// Multer Storage Configuration
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `attachment-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: any, cb: any) => {
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
    'video/mp4',
    'video/quicktime',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file format. Uploads are restricted to PDF, ZIP, Images, Word, Excel, and Videos.',
      ),
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max limit for videos/zips
});

// Apply auth middleware
taskRoutes.use(requireAuth);
labelRoutes.use(requireAuth);

// --- Task routes ---
taskRoutes.get('/', requireRole('ADMIN', 'DEVELOPER', 'CLIENT'), (req, res, next) =>
  taskController.list(req, res).catch(next),
);

taskRoutes.post('/', requireRole('ADMIN'), validate(createTaskSchema), (req, res, next) =>
  taskController.create(req, res).catch(next),
);

taskRoutes.get(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER', 'CLIENT'),
  validate(idParams, 'params'),
  (req, res, next) => taskController.getById(req, res).catch(next),
);

taskRoutes.patch(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  validate(updateTaskSchema),
  (req, res, next) => taskController.update(req, res).catch(next),
);

taskRoutes.delete('/:id', requireRole('ADMIN'), validate(idParams, 'params'), (req, res, next) =>
  taskController.remove(req, res).catch(next),
);

// Drag and drop position move
taskRoutes.patch(
  '/:id/move',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  validate(
    z.object({
      status: z.string().min(1),
      prevTaskId: z.string().uuid().optional(),
      nextTaskId: z.string().uuid().optional(),
    }),
  ),
  (req, res, next) => taskController.moveTask(req, res).catch(next),
);

// --- Comments routes ---
taskRoutes.post(
  '/:id/comments',
  requireRole('ADMIN', 'DEVELOPER', 'CLIENT'),
  validate(idParams, 'params'),
  validate(taskCommentSchema),
  (req, res, next) => taskController.addComment(req, res).catch(next),
);

const commentIdParams = z.object({ id: uuidSchema });

taskRoutes.patch(
  '/comments/:id',
  requireRole('ADMIN', 'DEVELOPER', 'CLIENT'),
  validate(commentIdParams, 'params'),
  validate(taskCommentSchema),
  (req, res, next) => taskController.updateComment(req, res).catch(next),
);

taskRoutes.delete(
  '/comments/:id',
  requireRole('ADMIN', 'DEVELOPER', 'CLIENT'),
  validate(commentIdParams, 'params'),
  (req, res, next) => taskController.deleteComment(req, res).catch(next),
);

// --- Checklists routes ---
taskRoutes.post(
  '/:id/checklists',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  validate(taskChecklistSchema),
  (req, res, next) => taskController.addChecklistItem(req, res).catch(next),
);

const checklistIdParams = z.object({ id: uuidSchema });

taskRoutes.patch(
  '/checklists/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(checklistIdParams, 'params'),
  validate(taskChecklistSchema.partial()),
  (req, res, next) => taskController.updateChecklistItem(req, res).catch(next),
);

taskRoutes.delete(
  '/checklists/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(checklistIdParams, 'params'),
  (req, res, next) => taskController.deleteChecklistItem(req, res).catch(next),
);

// --- Attachments routes ---
taskRoutes.post(
  '/:id/attachments',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  (req, res, next) => taskController.uploadAttachment(req, res).catch(next),
);

const attachmentIdParams = z.object({ id: uuidSchema });

taskRoutes.delete(
  '/attachments/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(attachmentIdParams, 'params'),
  (req, res, next) => taskController.deleteAttachment(req, res).catch(next),
);

// --- Label routes ---
labelRoutes.get('/', (req, res, next) => taskController.listLabels(req, res).catch(next));

labelRoutes.post('/', requireRole('ADMIN'), validate(taskLabelSchema), (req, res, next) =>
  taskController.createLabel(req, res).catch(next),
);

labelRoutes.delete('/:id', requireRole('ADMIN'), validate(idParams, 'params'), (req, res, next) =>
  taskController.deleteLabel(req, res).catch(next),
);
