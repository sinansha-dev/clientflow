import { taskRepository } from '../repositories/task.repository';

export const taskActivityService = {
  async log(taskId: string, type: string, description: string) {
    try {
      await taskRepository.logActivity(taskId, type, description);
    } catch (error) {
      console.error('Failed to log task activity:', error);
    }
  },
};
