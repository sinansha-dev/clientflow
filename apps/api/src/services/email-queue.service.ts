import type { SendEmailOptions, SendEmailResult } from '@clientflow/types';
import { emailService } from './email.service';
import { logger } from '../utils/logger';

export interface EmailJob {
  id: string;
  recipient: string;
  subject: string;
  html: string;
  text?: string | undefined;
  attachments?: SendEmailOptions['attachments'];
  providerName?: string | undefined;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | undefined;
  event?: string | undefined;
  createdAt: Date;
}

export interface IEmailQueueService {
  enqueue(jobInput: Omit<EmailJob, 'id' | 'createdAt'>): void;
  getQueueLength(): number;
  isProcessing(): boolean;
  drainQueue(): Promise<void>;
}

export class MemoryEmailQueueService implements IEmailQueueService {
  private queue: EmailJob[] = [];
  private processing = false;

  enqueue(jobInput: Omit<EmailJob, 'id' | 'createdAt'>): void {
    const job: EmailJob = {
      ...jobInput,
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      createdAt: new Date(),
    };

    this.queue.push(job);
    logger.info(
      { jobId: job.id, recipient: job.recipient, event: job.event, queueLength: this.queue.length },
      '[EmailQueue] Email job enqueued',
    );

    if (!this.processing) {
      setImmediate(() => {
        this.processQueue().catch((err) =>
          logger.error({ err }, '[EmailQueue] Unhandled error in processQueue loop'),
        );
      });
    }
  }

  public async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    logger.info(
      { queueLength: this.queue.length },
      '[EmailQueue] Starting background queue processing',
    );

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) continue;

      const startTime = Date.now();
      logger.info(
        { jobId: job.id, recipient: job.recipient, subject: job.subject, event: job.event },
        '[EmailQueue] Processing queued email job',
      );

      try {
        const result: SendEmailResult = await emailService.sendEmail(
          {
            to: job.recipient,
            subject: job.subject,
            html: job.html,
            text: job.text,
            attachments: job.attachments,
          },
          job.providerName,
        );

        const duration = Date.now() - startTime;
        if (result.success) {
          logger.info(
            {
              jobId: job.id,
              recipient: job.recipient,
              messageId: result.messageId,
              durationMs: duration,
            },
            '[EmailQueue] Email sent successfully from queue',
          );
        } else {
          logger.error(
            { jobId: job.id, recipient: job.recipient, error: result.error, durationMs: duration },
            '[EmailQueue] Email job failed in queue',
          );
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        logger.error(
          {
            jobId: job.id,
            recipient: job.recipient,
            error: err?.message || err,
            durationMs: duration,
          },
          '[EmailQueue] Exception processing email job from queue',
        );
      }
    }

    this.processing = false;
    logger.info('[EmailQueue] Queue empty. Worker standing by.');
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Helper method for unit tests or shutdown procedures to wait until the queue is completely drained.
   */
  async drainQueue(): Promise<void> {
    if (!this.processing && this.queue.length > 0) {
      await this.processQueue();
    }
    while (this.processing || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

export const emailQueueService = new MemoryEmailQueueService();
