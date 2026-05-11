import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WorkflowEventListener {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('workflow.state.changed')
  async handleStateChanged(payload: {
    submissionId: string;
    instanceId: string;
    fromState: string;
    toState: string;
    action: string;
    actorId: string;
  }) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: payload.submissionId },
      select: { submittedBy: true },
    });

    if (!submission || submission.submittedBy === payload.actorId) return;

    await this.prisma.notification.create({
      data: {
        userId: submission.submittedBy,
        title: 'Workflow Update',
        content: `Your submission has been moved from "${payload.fromState}" to "${payload.toState}" (action: ${payload.action}).`,
        type: 'INFO',
        metadata: {
          submissionId: payload.submissionId,
          instanceId: payload.instanceId,
          action: payload.action,
        },
      },
    });
  }

  @OnEvent('workflow.completed')
  async handleCompleted(payload: {
    submissionId: string;
    instanceId: string;
    finalState: string;
  }) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: payload.submissionId },
      select: { submittedBy: true },
    });

    if (!submission) return;

    const lower = payload.finalState.toLowerCase();
    let type = 'SUCCESS';
    let title = 'Workflow Completed';

    if (lower.includes('reject')) {
      type = 'WARNING';
      title = 'Submission Rejected';
    } else if (lower.includes('cancel')) {
      type = 'INFO';
      title = 'Submission Cancelled';
    } else if (lower.includes('return')) {
      type = 'WARNING';
      title = 'Submission Returned for Edit';
    }

    await this.prisma.notification.create({
      data: {
        userId: submission.submittedBy,
        title,
        content: `Your submission has reached state: "${payload.finalState}".`,
        type,
        metadata: {
          submissionId: payload.submissionId,
          instanceId: payload.instanceId,
          finalState: payload.finalState,
        },
      },
    });
  }

  @OnEvent('workflow.resubmitted')
  async handleResubmitted(payload: {
    originalSubmissionId: string;
    newSubmissionId: string;
    actorId: string;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: payload.actorId,
        title: 'Resubmission Created',
        content:
          'A new revision has been created for your submission and is now under review.',
        type: 'INFO',
        metadata: {
          originalSubmissionId: payload.originalSubmissionId,
          newSubmissionId: payload.newSubmissionId,
        },
      },
    });
  }
}
