import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async findMy(
    userId: string,
    page: number = 1,
    limit: number = 20,
    read?: boolean,
  ) {
    const where: Prisma.NotificationWhereInput = { userId };
    if (read !== undefined) {
      where.read = read;
    }

    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          read: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const unread = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { unread };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('notification.NOT_FOUND');
    }

    await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return { success: true };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { success: true, updated: result.count };
  }

  async notifyWorkflowStateChanged(payload: {
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

  async notifyWorkflowCompleted(payload: {
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

  async notifyWorkflowResubmitted(payload: {
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
