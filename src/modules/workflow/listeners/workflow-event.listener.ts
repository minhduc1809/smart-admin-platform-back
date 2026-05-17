import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class WorkflowEventListener {
  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('workflow.state.changed')
  async handleStateChanged(payload: {
    submissionId: string;
    instanceId: string;
    fromState: string;
    toState: string;
    action: string;
    actorId: string;
  }) {
    return this.notificationService.notifyWorkflowStateChanged(payload);
  }

  @OnEvent('workflow.completed')
  async handleCompleted(payload: {
    submissionId: string;
    instanceId: string;
    finalState: string;
  }) {
    return this.notificationService.notifyWorkflowCompleted(payload);
  }

  @OnEvent('workflow.resubmitted')
  async handleResubmitted(payload: {
    originalSubmissionId: string;
    newSubmissionId: string;
    actorId: string;
  }) {
    return this.notificationService.notifyWorkflowResubmitted(payload);
  }
}
