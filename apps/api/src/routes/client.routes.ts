import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  clientContactSchema,
  clientNoteSchema,
  createClientSchema,
  updateClientSchema,
  uuidSchema,
} from '@clientflow/shared';
import { clientController } from '../controllers/client.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

export const clientRoutes = Router();
const idParams = z.object({ id: uuidSchema });
const portalLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

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
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/zip',
    'application/x-zip-compressed',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, Images, Word, Excel, and ZIP are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB default max limit
});

// Apply auth middleware to all client/contact/note/file endpoints
clientRoutes.use(requireAuth);

// --- Clients Endpoints ---
clientRoutes.get('/', requireRole('ADMIN', 'DEVELOPER'), (req, res, next) =>
  clientController.list(req, res).catch(next),
);

clientRoutes.post('/', requireRole('ADMIN'), validate(createClientSchema), (req, res, next) =>
  clientController.create(req, res).catch(next),
);

clientRoutes.post(
  '/:id/portal-login',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  validate(portalLoginSchema),
  (req, res, next) => clientController.createPortalLogin(req, res).catch(next),
);
clientRoutes.get(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => clientController.getById(req, res).catch(next),
);

clientRoutes.patch(
  '/:id',
  requireRole('ADMIN', 'DEVELOPER'), // Developers can update, but inside the controller we restrict modifying billing details
  validate(idParams, 'params'),
  validate(updateClientSchema),
  (req, res, next) => clientController.update(req, res).catch(next),
);

clientRoutes.delete('/:id', requireRole('ADMIN'), validate(idParams, 'params'), (req, res, next) =>
  clientController.remove(req, res).catch(next),
);

clientRoutes.post(
  '/:id/archive',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => clientController.archive(req, res).catch(next),
);

clientRoutes.post(
  '/:id/restore',
  requireRole('ADMIN'),
  validate(idParams, 'params'),
  (req, res, next) => clientController.restore(req, res).catch(next),
);

// --- Contacts Endpoints ---
clientRoutes.get(
  '/:id/contacts',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => clientController.getContacts(req, res).catch(next),
);

clientRoutes.post(
  '/:id/contacts',
  requireRole('ADMIN'), // Admin only can manage contacts
  validate(idParams, 'params'),
  validate(clientContactSchema),
  (req, res, next) => clientController.addContact(req, res).catch(next),
);

// Note that the contacts PATCH/DELETE URLs use contact ID, not client ID
// We can define custom schemas for contact id validation
const contactIdParams = z.object({ id: uuidSchema });

clientRoutes.patch(
  '/contacts/:id',
  requireRole('ADMIN'),
  validate(contactIdParams, 'params'),
  validate(clientContactSchema.partial()),
  (req, res, next) => clientController.updateContact(req, res).catch(next),
);

clientRoutes.delete(
  '/contacts/:id',
  requireRole('ADMIN'),
  validate(contactIdParams, 'params'),
  (req, res, next) => clientController.deleteContact(req, res).catch(next),
);

// --- Notes Endpoints ---
clientRoutes.get(
  '/:id/notes',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => clientController.getNotes(req, res).catch(next),
);

clientRoutes.post(
  '/:id/notes',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  validate(clientNoteSchema),
  (req, res, next) => clientController.addNote(req, res).catch(next),
);

clientRoutes.patch(
  '/notes/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(contactIdParams, 'params'),
  validate(clientNoteSchema),
  (req, res, next) => clientController.updateNote(req, res).catch(next),
);

clientRoutes.delete(
  '/notes/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(contactIdParams, 'params'),
  (req, res, next) => clientController.deleteNote(req, res).catch(next),
);

// --- Files Endpoints ---
clientRoutes.get(
  '/:id/files',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(idParams, 'params'),
  (req, res, next) => clientController.getFiles(req, res).catch(next),
);

// POST handles multipart form file upload
clientRoutes.post(
  '/:id/files',
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
  (req, res, next) => clientController.uploadFile(req, res).catch(next),
);

clientRoutes.delete(
  '/files/:id',
  requireRole('ADMIN', 'DEVELOPER'),
  validate(contactIdParams, 'params'),
  (req, res, next) => clientController.deleteFile(req, res).catch(next),
);
