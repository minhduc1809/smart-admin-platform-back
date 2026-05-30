import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let prisma: any;
  let eventEmitter: any;
  let service: NotificationService;

  beforeEach(() => {
    eventEmitter = {
      emit: jest.fn(),
    };
    prisma = {
      notification: {
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      submission: {
        findUnique: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
      },
    };

    service = new NotificationService(prisma, eventEmitter);
  });

  it('getUnreadCount returns unread count', async () => {
    prisma.notification.count.mockResolvedValue(3);

    const result = await service.getUnreadCount('user-1');

    expect(result).toEqual({ unread: 3 });
  });

  it('markAsRead throws when notification not found', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead('user-1', 'notif-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('notifyWorkflowStateChanged skips self notifications', async () => {
    prisma.submission.findUnique.mockResolvedValue({ submittedBy: 'user-1' });

    await service.notifyWorkflowStateChanged({
      submissionId: 'sub-1',
      instanceId: 'inst-1',
      fromState: 'pending',
      toState: 'approved',
      action: 'approve',
      actorId: 'user-1',
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('notifyWorkflowStateChanged creates notification for other users', async () => {
    prisma.submission.findUnique.mockResolvedValue({ submittedBy: 'user-2' });

    await service.notifyWorkflowStateChanged({
      submissionId: 'sub-1',
      instanceId: 'inst-1',
      fromState: 'pending',
      toState: 'approved',
      action: 'approve',
      actorId: 'user-1',
    });

    expect(prisma.notification.create).toHaveBeenCalled();
  });
});
