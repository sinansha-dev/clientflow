import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';
import { clientRepository } from '../repositories/client.repository';
import { activityService } from '../services/activity.service';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';
import fs from 'fs';
import path from 'path';

export const clientController = {
  async list(req: Request, res: Response) {
    const user = req.user!;
    const { search, status, industry, country, managerId, sortBy, sortOrder, page, limit } =
      req.query;

    // Enforce role permission: Developer can only view assigned clients
    let resolvedManagerId = managerId as string | undefined;
    if (user.role === 'DEVELOPER') {
      resolvedManagerId = user.id;
    }

    const params: Parameters<typeof clientRepository.list>[0] = {};
    if (search) params.search = search as string;
    if (status) params.status = status as string;
    if (industry) params.industry = industry as string;
    if (country) params.country = country as string;
    if (resolvedManagerId) params.managerId = resolvedManagerId;
    if (sortBy) params.sortBy = sortBy as string;
    if (sortOrder) params.sortOrder = sortOrder as 'asc' | 'desc';
    if (page) params.page = parseInt(page as string, 10);
    if (limit) params.limit = parseInt(limit as string, 10);

    const result = await clientRepository.list(params);

    return ok(res, 'Clients retrieved successfully', result);
  },

  async getById(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }

    // Enforce role permission: Developer can only view assigned clients
    if (user.role === 'DEVELOPER' && client.assignedManagerId !== user.id) {
      throw forbidden('You can only view assigned clients');
    }

    return ok(res, 'Client retrieved successfully', client);
  },

  async create(req: Request, res: Response) {
    const body = req.body;

    const nameExists = await clientRepository.checkDuplicateName(body.companyName);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ path: 'companyName', message: 'Company name already exists' }],
      });
    }

    // Separate primary contact if provided
    const { primaryContact, ...clientData } = body;

    const client = await clientRepository.create(clientData);

    // If primary contact fields are filled, create a primary contact
    if (primaryContact && primaryContact.name) {
      await clientRepository.addContact(client.id, {
        ...primaryContact,
        primaryContact: true,
      });
    }

    await activityService.log(
      client.id,
      'CLIENT_CREATED',
      `Client company ${client.companyName} was created`,
    );

    // Fetch the client with its contacts and details
    const createdClient = await clientRepository.findById(client.id);
    return ok(res, 'Client created successfully', createdClient, 201);
  },

  async createPortalLogin(req: Request, res: Response) {
    const id = req.params.id!;
    const { email, password, firstName, lastName } = req.body;

    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.role !== 'CLIENT') {
      return res.status(400).json({
        success: false,
        message: 'This email already belongs to a staff account',
      });
    }

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firstName,
            lastName,
            status: 'ACTIVE',
            ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
          },
        })
      : await prisma.user.create({
          data: {
            email,
            password: await bcrypt.hash(password, 12),
            firstName,
            lastName,
            role: 'CLIENT',
            status: 'ACTIVE',
          },
        });

    await prisma.clientPortalAccess.upsert({
      where: { clientId_userId: { clientId: id, userId: user.id } },
      create: { clientId: id, userId: user.id, status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });

    await activityService.log(
      id,
      'PORTAL_ACCESS_CREATED',
      `Portal login enabled for ${firstName} ${lastName}`,
    );

    return ok(
      res,
      'Client portal login created successfully',
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
      201,
    );
  },
  async update(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }

    // Enforce role permission: Developer cannot edit billing information
    const billingFields = ['taxNumber', 'billingAddress', 'shippingAddress', 'currency'];
    const modifyingBilling = billingFields.some((field) => body[field] !== undefined);

    if (user.role === 'DEVELOPER') {
      if (client.assignedManagerId !== user.id) {
        throw forbidden('You can only edit assigned clients');
      }
      if (modifyingBilling) {
        throw forbidden('Developers are not permitted to edit billing information');
      }
    }

    if (body.companyName) {
      const nameExists = await clientRepository.checkDuplicateName(body.companyName, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ path: 'companyName', message: 'Company name already exists' }],
        });
      }
    }

    const updated = await clientRepository.update(id, body);
    await activityService.log(id, 'CLIENT_UPDATED', `Client company details were updated`);

    return ok(res, 'Client updated successfully', updated);
  },

  async archive(req: Request, res: Response) {
    const id = req.params.id!;

    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }

    await clientRepository.archive(id);
    await activityService.log(id, 'CLIENT_ARCHIVED', `Client was archived`);

    return ok(res, 'Client archived successfully');
  },

  async restore(req: Request, res: Response) {
    const id = req.params.id!;

    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }

    await clientRepository.restore(id);
    await activityService.log(id, 'CLIENT_RESTORED', `Client was restored`);

    return ok(res, 'Client restored successfully');
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id!;

    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }

    await clientRepository.softDelete(id);
    await activityService.log(id, 'CLIENT_DELETED', `Client was deleted`);

    return ok(res, 'Client soft-deleted successfully');
  },

  // Contact Controllers
  async getContacts(req: Request, res: Response) {
    const id = req.params.id!;
    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }
    return ok(res, 'Contacts retrieved successfully', client.contacts);
  },

  async addContact(req: Request, res: Response) {
    const id = req.params.id!;
    const body = req.body;

    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }

    const contact = await clientRepository.addContact(id, body);
    await activityService.log(
      id,
      'CONTACT_ADDED',
      `Contact ${contact.name} (${contact.position}) was added`,
    );

    return ok(res, 'Contact added successfully', contact, 201);
  },

  async updateContact(req: Request, res: Response) {
    const id = req.params.id!;
    const body = req.body;

    const contact = await prisma.clientContact.findFirst({ where: { id } });
    if (!contact) {
      throw notFound('Contact not found');
    }

    const updated = await clientRepository.updateContact(id, contact.clientId, body);
    await activityService.log(
      contact.clientId,
      'CONTACT_EDITED',
      `Contact ${updated.name} was edited`,
    );

    return ok(res, 'Contact updated successfully', updated);
  },

  async deleteContact(req: Request, res: Response) {
    const id = req.params.id!;

    const contact = await prisma.clientContact.findFirst({ where: { id } });
    if (!contact) {
      throw notFound('Contact not found');
    }

    await clientRepository.deleteContact(id);
    await activityService.log(
      contact.clientId,
      'CONTACT_DELETED',
      `Contact ${contact.name} was deleted`,
    );

    return ok(res, 'Contact deleted successfully');
  },

  // Note Controllers
  async getNotes(req: Request, res: Response) {
    const id = req.params.id!;
    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }
    return ok(res, 'Notes retrieved successfully', client.notes);
  },

  async addNote(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const { note } = req.body;

    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }

    const clientNote = await clientRepository.addNote(id, user.id, note);
    await activityService.log(
      id,
      'NOTE_ADDED',
      `Internal note was added by ${user.firstName} ${user.lastName}`,
    );

    return ok(res, 'Note added successfully', clientNote, 201);
  },

  async updateNote(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const { note } = req.body;

    const clientNote = await clientRepository.findNoteById(id);
    if (!clientNote) {
      throw notFound('Note not found');
    }

    if (clientNote.userId !== user.id && user.role !== 'ADMIN') {
      throw forbidden('You can only edit your own notes');
    }

    const updated = await clientRepository.updateNote(id, note);
    return ok(res, 'Note updated successfully', updated);
  },

  async deleteNote(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const clientNote = await clientRepository.findNoteById(id);
    if (!clientNote) {
      throw notFound('Note not found');
    }

    if (clientNote.userId !== user.id && user.role !== 'ADMIN') {
      throw forbidden('You can only delete your own notes');
    }

    await clientRepository.deleteNote(id);
    return ok(res, 'Note deleted successfully');
  },

  // File Controllers
  async getFiles(req: Request, res: Response) {
    const id = req.params.id!;
    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }
    return ok(res, 'Files retrieved successfully', client.files);
  },

  async uploadFile(req: Request, res: Response) {
    const id = req.params.id!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const client = await clientRepository.findById(id);
    if (!client) {
      throw notFound('Client not found');
    }

    // Save upload metadata
    const fileUrl = `/uploads/${file.filename}`;
    const clientFile = await clientRepository.addFile(id, {
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      url: fileUrl,
    });

    await activityService.log(id, 'FILE_UPLOADED', `Document "${file.originalname}" was uploaded`);

    return ok(res, 'File uploaded successfully', clientFile, 201);
  },

  async deleteFile(req: Request, res: Response) {
    const id = req.params.id!;

    const clientFile = await clientRepository.findFileById(id);
    if (!clientFile) {
      throw notFound('File not found');
    }

    // Try deleting physical file
    const filePath = path.join(__dirname, '../../uploads', path.basename(clientFile.url));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Failed to delete physical file:', err);
      }
    }

    await clientRepository.deleteFile(id);
    await activityService.log(
      clientFile.clientId,
      'FILE_DELETED',
      `Document "${clientFile.name}" was deleted`,
    );

    return ok(res, 'File deleted successfully');
  },
};
