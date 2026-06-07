import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class WorkflowEventListener {
  private readonly logger = new Logger(WorkflowEventListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('workflow.state.changed')
  async handleStateChanged(payload: {
    submissionId: string;
    instanceId: string;
    fromState: string;
    toState: string;
    action: string;
    actorId: string;
    comment?: string;
    isCompleted?: boolean;
  }) {
    try {
      await this.notificationService.notifyWorkflowStateChanged(payload);
    } catch (error) {
      this.logger.error(
        `Failed to send state-changed notification for submission ${payload.submissionId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @OnEvent('workflow.completed')
  async handleCompleted(payload: {
    submissionId: string;
    instanceId: string;
    finalState: string;
    action?: string;
    actorId?: string;
    comment?: string;
  }) {
    try {
      await this.notificationService.notifyWorkflowCompleted(payload);
    } catch (error) {
      this.logger.error(
        `Failed to send completed notification for submission ${payload.submissionId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @OnEvent('workflow.resubmitted')
  async handleResubmitted(payload: {
    originalSubmissionId: string;
    newSubmissionId: string;
    actorId: string;
  }) {
    try {
      await this.notificationService.notifyWorkflowResubmitted(payload);
    } catch (error) {
      this.logger.error(
        `Failed to send resubmitted notification for submission ${payload.originalSubmissionId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
