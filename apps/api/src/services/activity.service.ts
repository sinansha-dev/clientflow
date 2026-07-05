import { clientRepository } from '../repositories/client.repository';

export const activityService = {
  async log(clientId: string, type: string, description: string) {
    try {
      await clientRepository.logActivity(clientId, type, description);
    } catch (error) {
      // Log errors silently so activity logging doesn't crash the main request
      console.error('Failed to log client activity:', error);
    }
  },
};
