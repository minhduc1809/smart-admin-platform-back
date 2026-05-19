import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeGateway } from '../realtime.gateway';
import {
  NotificationCreatedPayload,
  JobProgressPayload,
  JobCompletedPayload,
} from '../../../common/events/realtime.events';

@Injectable()
export class RealtimeEventListener {
  private readonly logger = new Logger(RealtimeEventListener.name);

  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  @OnEvent('notification.created')
  handleNotificationCreated(payload: NotificationCreatedPayload) {
    this.logger.log(`Received internal event "notification.created" for user: ${payload.userId}`);
    this.realtimeGateway.sendToUser(payload.userId, 'notification', payload);
  }

  @OnEvent('job.progress')
  handleJobProgress(payload: JobProgressPayload) {
    this.logger.log(`Received internal event "job.progress" for job ${payload.jobId} -> progress: ${payload.progress}%`);
    this.realtimeGateway.sendToUser(payload.userId, 'job.progress', {
      jobId: payload.jobId,
      progress: payload.progress,
    });
  }

  @OnEvent('job.completed')
  handleJobCompleted(payload: JobCompletedPayload) {
    this.logger.log(`Received internal event "job.completed" for job ${payload.jobId} -> status: ${payload.status}`);
    this.realtimeGateway.sendToUser(payload.userId, 'job.completed', {
      jobId: payload.jobId,
      status: payload.status,
      filepath: payload.filepath,
      error: payload.error,
    });
  }
}
