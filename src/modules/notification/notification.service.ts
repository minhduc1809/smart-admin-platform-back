import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  HR: 'Nhân sự',
  USER: 'Nhân viên',
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private formatDayMonth(date: Date | string) {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  private async getActorDisplay(userId: string, withRole = true) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        username: true,
        email: true,
        role: true,
      },
    });
    if (!user) return 'Người phụ trách';
    const name =
      [user.lastName, user.firstName].filter(Boolean).join(' ') ||
      user.username ||
      user.email ||
      'Người phụ trách';
    if (!withRole || !user.role) return name;
    return `${name} (${ROLE_LABELS[user.role] ?? user.role})`;
  }

  private async createAndEmit(args: Prisma.NotificationCreateArgs) {
    if (!args.data.tenantId && args.data.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: args.data.userId },
        select: { tenantId: true },
      });
      if (user) {
        args.data.tenantId = user.tenantId;
      }
    }
    const notification = await this.prisma.notification.create(args);
    this.eventEmitter.emit('notification.created', notification);
    return notification;
  }

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
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
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
    comment?: string;
    isCompleted?: boolean;
  }) {
    if (payload.isCompleted) return;

    const submission = await this.prisma.submission.findUnique({
      where: { id: payload.submissionId },
      select: { submittedBy: true, form: { select: { name: true } } },
    });

    if (!submission || submission.submittedBy === payload.actorId) return;

    const formName = (submission as any).form?.name ?? 'yêu cầu';
    const actor = await this.getActorDisplay(payload.actorId);
    const reason = payload.comment ? ` Lý do: ${payload.comment}` : '';
    const action = (payload.action || '').toLowerCase();

    let type = 'INFO';
    let title = 'Cập nhật quy trình';
    let content = `Đơn "${formName}" của bạn đã chuyển từ "${payload.fromState}" sang "${payload.toState}".`;

    if (action.includes('approve')) {
      type = 'SUCCESS';
      title = 'Yêu cầu đã được phê duyệt';
      content = `Đơn "${formName}" của bạn đã được ${actor} phê duyệt.`;
    } else if (action.includes('reject')) {
      type = 'ERROR';
      title = 'Yêu cầu bị từ chối';
      content = `Đơn "${formName}" của bạn đã bị ${actor} từ chối.${reason}`;
    } else if (action.includes('return')) {
      type = 'WARNING';
      title = 'Yêu cầu cần chỉnh sửa';
      content = `Đơn "${formName}" của bạn đã được ${actor} trả lại để chỉnh sửa.${reason}`;
    } else if (action.includes('cancel')) {
      title = 'Yêu cầu đã bị hủy';
      content = `Đơn "${formName}" của bạn đã bị hủy.`;
    }

    await this.createAndEmit({
      data: {
        userId: submission.submittedBy,
        title,
        content,
        type,
        metadata: {
          submissionId: payload.submissionId,
          instanceId: payload.instanceId,
          action: payload.action,
        },
      } as any,
    });
  }

  async notifyWorkflowCompleted(payload: {
    submissionId: string;
    instanceId: string;
    finalState: string;
    action?: string;
    actorId?: string;
    comment?: string;
  }) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: payload.submissionId },
      select: { submittedBy: true, form: { select: { name: true } } },
    });

    if (!submission) return;
    if (payload.actorId && submission.submittedBy === payload.actorId) return;

    const formName = (submission as any).form?.name ?? 'yêu cầu';
    const actor = payload.actorId
      ? await this.getActorDisplay(payload.actorId)
      : '';
    const reason = payload.comment ? ` Lý do: ${payload.comment}` : '';
    const lower = payload.finalState.toLowerCase();

    let type = 'SUCCESS';
    let title = 'Yêu cầu đã được phê duyệt';
    let content = actor
      ? `Đơn "${formName}" của bạn đã được ${actor} phê duyệt.`
      : `Đơn "${formName}" của bạn đã được phê duyệt.`;

    if (lower.includes('reject')) {
      type = 'ERROR';
      title = 'Yêu cầu bị từ chối';
      content = `Đơn "${formName}" của bạn đã bị từ chối.${reason}`;
    } else if (lower.includes('cancel')) {
      type = 'INFO';
      title = 'Yêu cầu đã bị hủy';
      content = `Đơn "${formName}" của bạn đã bị hủy.`;
    } else if (lower.includes('return')) {
      type = 'WARNING';
      title = 'Yêu cầu cần chỉnh sửa';
      content = `Đơn "${formName}" của bạn đã được trả lại để chỉnh sửa.${reason}`;
    }

    await this.createAndEmit({
      data: {
        userId: submission.submittedBy,
        title,
        content,
        type,
        metadata: {
          submissionId: payload.submissionId,
          instanceId: payload.instanceId,
          finalState: payload.finalState,
        },
      } as any,
    });
  }

  async notifyWorkflowResubmitted(payload: {
    originalSubmissionId: string;
    newSubmissionId: string;
    actorId: string;
  }) {
    await this.createAndEmit({
      data: {
        userId: payload.actorId,
        title: 'Đã tạo phiên bản mới',
        content:
          'Phiên bản chỉnh sửa cho yêu cầu của bạn đã được tạo và đang chờ phê duyệt.',
        type: 'INFO',
        metadata: {
          originalSubmissionId: payload.originalSubmissionId,
          newSubmissionId: payload.newSubmissionId,
        },
      } as any,
    });
  }

  async notifyDelegationCreated(payload: {
    delegationId: string;
    fromUserId: string;
    toUserId: string;
    startDate: Date | string;
    endDate: Date | string;
    formCount?: number;
    workflowCount?: number;
  }) {
    const fromName = await this.getActorDisplay(payload.fromUserId, false);
    const scopes: string[] = [];
    if (payload.formCount) scopes.push(`${payload.formCount} biểu mẫu`);
    if (payload.workflowCount) scopes.push(`${payload.workflowCount} quy trình`);
    const scopeText = scopes.length ? ` Phạm vi: ${scopes.join(', ')}.` : '';

    await this.createAndEmit({
      data: {
        userId: payload.toUserId,
        title: 'Bạn nhận được ủy quyền mới',
        content: `${fromName} đã ủy quyền phê duyệt cho bạn từ ${this.formatDayMonth(payload.startDate)} đến ${this.formatDayMonth(payload.endDate)}.${scopeText}`,
        type: 'INFO',
        metadata: { delegationId: payload.delegationId },
      } as any,
    });
  }

  async notifyApproversReminder(
    submissionId: string,
    approverRoles: string[],
    formName: string,
  ) {
    if (!approverRoles.length) return { sent: 0 };

    const approvers = await this.prisma.user.findMany({
      where: {
        role: { in: approverRoles as any[] },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!approvers.length) return { sent: 0 };

    await Promise.all(
      approvers.map((approver) =>
        this.createAndEmit({
          data: {
            userId: approver.id,
            title: 'Yêu cầu chờ phê duyệt',
            content: `Đơn "${formName}" đang chờ bạn phê duyệt.`,
            type: 'WARNING',
            metadata: {
              submissionId,
              reminder: true,
            },
          } as any,
        }),
      ),
    );

    return { sent: approvers.length };
  }
}
