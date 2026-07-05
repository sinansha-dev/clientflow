import { projectRepository } from '../repositories/project.repository';

export const projectActivityService = {
  async log(projectId: string, type: string, description: string) {
    try {
      await projectRepository.logActivity(projectId, type, description);
    } catch (error) {
      console.error('Failed to log project activity:', error);
    }
  },
};
