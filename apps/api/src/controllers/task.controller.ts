import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { taskRepository } from '../repositories/task.repository';
import { taskActivityService } from '../services/task-activity.service';
import { ok } from '../utils/http';
import { forbidden, notFound } from '../utils/errors';
import fs from 'fs';
import path from 'path';

export const taskController = {
  async list(req: Request, res: Response) {
    const user = req.user!;
    const {
      projectId,
      assigneeId,
      labelId,
      status,
      priority,
      search,
      overdue,
      completed,
      sortBy,
      sortOrder,
    } = req.query;

    const params: any = {
      projectId: projectId as string,
      assigneeId: assigneeId as string,
      labelId: labelId as string,
      status: status as string,
      priority: priority as string,
      search: search as string,
      overdue: overdue === 'true',
      completed: completed === 'true' ? true : completed === 'false' ? false : undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    // Developers only view assigned tasks if no specific project filters
    if (user.role === 'DEVELOPER' && (!projectId || projectId === 'ALL')) {
      params.userId = user.id;
    }

    const items = await taskRepository.list(params);
    return ok(res, 'Tasks retrieved successfully', items);
  },

  async getById(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;

    const task = await taskRepository.findById(id);
    if (!task) {
      throw notFound('Task not found');
    }

    // Client verification: Clients can only see completed tasks
    if (user.role === 'CLIENT' && task.status !== 'COMPLETED') {
      throw forbidden('Access denied');
    }

    return ok(res, 'Task retrieved successfully', task);
  },

  async create(req: Request, res: Response) {
    const user = req.user!;
    const body = req.body;

    // Check project exists
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, deletedAt: null },
    });
    if (!project) {
      return res.status(400).json({ success: false, message: 'Selected project does not exist' });
    }

    const taskData = {
      ...body,
      createdBy: user.id,
    };

    const task = await taskRepository.create(taskData);
    await taskActivityService.log(task.id, 'TASK_CREATED', `Task "${task.title}" was created`);

    const createdTask = await taskRepository.findById(task.id);
    return ok(res, 'Task created successfully', createdTask, 201);
  },

  async update(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const body = req.body;

    const task = await taskRepository.findById(id);
    if (!task) {
      throw notFound('Task not found');
    }

    // Developer restrictions: Can only edit status / checklist / log time if assigned to task
    if (user.role === 'DEVELOPER') {
      const isAssigned = task.assignees?.some((a: { id: string }) => a.id === user.id);
      if (!isAssigned) {
        throw forbidden('You are not assigned to this task');
      }

      // Prohibit changing project / estimation / critical config
      const restrictedFields = ['projectId', 'estimatedHours', 'title', 'description', 'priority'];
      const isModifyingRestricted = restrictedFields.some((field) => body[field] !== undefined);
      if (isModifyingRestricted) {
        throw forbidden(
          'Developers are restricted to editing task status, checklists, and comments',
        );
      }
    }

    const updated = await taskRepository.update(id, body);

    // Log updates
    if (body.status && body.status !== task.status) {
      await taskActivityService.log(id, 'STATUS_CHANGED', `Task status changed to ${body.status}`);
    }
    if (body.priority && body.priority !== task.priority) {
      await taskActivityService.log(
        id,
        'PRIORITY_CHANGED',
        `Task priority changed to ${body.priority}`,
      );
    }

    const result = await taskRepository.findById(id);
    return ok(res, 'Task updated successfully', result);
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id!;

    const task = await taskRepository.findById(id);
    if (!task) {
      throw notFound('Task not found');
    }

    await taskRepository.softDelete(id);
    return ok(res, 'Task deleted successfully');
  },

  // Drag and Drop move controller
  async moveTask(req: Request, res: Response) {
    const id = req.params.id!;
    const { status, prevTaskId, nextTaskId } = req.body;

    const task = await taskRepository.findById(id);
    if (!task) {
      throw notFound('Task not found');
    }

    const updated = await taskRepository.moveTask(id, { status, prevTaskId, nextTaskId });
    await taskActivityService.log(id, 'STATUS_CHANGED', `Task moved to column ${status}`);

    return ok(res, 'Task position saved successfully', updated);
  },

  // Comments Controllers
  async addComment(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const { comment } = req.body;

    const task = await taskRepository.findById(id);
    if (!task) {
      throw notFound('Task not found');
    }

    const taskComment = await taskRepository.addComment(id, user.id, comment);
    await taskActivityService.log(id, 'COMMENT_ADDED', `Comment added by ${user.firstName}`);

    return ok(res, 'Comment added successfully', taskComment, 201);
  },

  async updateComment(req: Request, res: Response) {
    const id = req.params.id as string;
    const { comment } = req.body;

    const exists = await taskRepository.findCommentById(id);
    if (!exists) {
      throw notFound('Comment not found');
    }

    const updated = await taskRepository.updateComment(id, comment);
    return ok(res, 'Comment updated successfully', updated);
  },

  async deleteComment(req: Request, res: Response) {
    const id = req.params.id as string;

    const exists = await taskRepository.findCommentById(id);
    if (!exists) {
      throw notFound('Comment not found');
    }

    await taskRepository.deleteComment(id);
    return ok(res, 'Comment deleted successfully');
  },

  // Checklist Controllers
  async addChecklistItem(req: Request, res: Response) {
    const id = req.params.id!;
    const { title } = req.body;

    const task = await taskRepository.findById(id);
    if (!task) {
      throw notFound('Task not found');
    }

    const item = await taskRepository.addChecklistItem(id, title);
    await taskActivityService.log(id, 'CHECKLIST_UPDATED', `Checklist item "${title}" was added`);

    return ok(res, 'Checklist item added successfully', item, 201);
  },

  async updateChecklistItem(req: Request, res: Response) {
    const id = req.params.id as string;
    const body = req.body;

    const item = await taskRepository.findChecklistItemById(id);
    if (!item) {
      throw notFound('Checklist item not found');
    }

    const updated = await taskRepository.updateChecklistItem(id, body);
    await taskActivityService.log(
      item.taskId,
      'CHECKLIST_UPDATED',
      `Checklist item status was updated`,
    );

    return ok(res, 'Checklist item updated successfully', updated);
  },

  async deleteChecklistItem(req: Request, res: Response) {
    const id = req.params.id as string;

    const item = await taskRepository.findChecklistItemById(id);
    if (!item) {
      throw notFound('Checklist item not found');
    }

    await taskRepository.deleteChecklistItem(id);
    return ok(res, 'Checklist item deleted successfully');
  },

  // Attachments Controllers
  async uploadAttachment(req: Request, res: Response) {
    const user = req.user!;
    const id = req.params.id!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const task = await taskRepository.findById(id);
    if (!task) {
      throw notFound('Task not found');
    }

    const fileUrl = `/uploads/${file.filename}`;
    const attachment = await taskRepository.addAttachment(id, {
      name: file.originalname,
      url: fileUrl,
      size: file.size,
      uploadedById: user.id,
    });

    await taskActivityService.log(
      id,
      'FILE_UPLOADED',
      `Attachment "${file.originalname}" was uploaded`,
    );

    return ok(res, 'Attachment uploaded successfully', attachment, 201);
  },

  async deleteAttachment(req: Request, res: Response) {
    const id = req.params.id as string;

    const attachment = await taskRepository.findAttachmentById(id);
    if (!attachment) {
      throw notFound('Attachment not found');
    }

    // Delete physical file
    const filePath = path.join(__dirname, '../../uploads', path.basename(attachment.url));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(err);
      }
    }

    await taskRepository.deleteAttachment(id);
    return ok(res, 'Attachment deleted successfully');
  },

  // Labels Controllers
  async listLabels(req: Request, res: Response) {
    const items = await taskRepository.listLabels();
    return ok(res, 'Labels retrieved successfully', items);
  },

  async createLabel(req: Request, res: Response) {
    const { name, color } = req.body;
    const label = await taskRepository.createLabel(name, color);
    return ok(res, 'Label created successfully', label, 201);
  },

  async deleteLabel(req: Request, res: Response) {
    const id = req.params.id as string;

    const exists = await taskRepository.findLabelById(id);
    if (!exists) {
      throw notFound('Label not found');
    }

    await taskRepository.deleteLabel(id);
    return ok(res, 'Label deleted successfully');
  },
};
