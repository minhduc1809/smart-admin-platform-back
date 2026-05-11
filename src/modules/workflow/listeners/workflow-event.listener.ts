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

    await this.prisma.notification.create({
      data: {
        userId: submission.submittedBy,
        title: 'Workflow Completed',
        content: `Your submission has reached final state: "${payload.finalState}".`,
        type: payload.finalState.toLowerCase().includes('reject')
          ? 'WARNING'
          : 'SUCCESS',
        metadata: {
          submissionId: payload.submissionId,
          instanceId: payload.instanceId,
          finalState: payload.finalState,
        },
      },
    });
  }
}
