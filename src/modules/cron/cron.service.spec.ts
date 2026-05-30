import { CronService } from './cron.service';
import * as fs from 'fs';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

describe('CronService', () => {
  const fsMock = fs as jest.Mocked<typeof fs>;

  it('cleanupExpiredExports deletes record after removing file', async () => {
    const prisma = {
      jobRecord: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'job-1', result: { filepath: 'exports/file-1.xlsx' } },
          ]),
        delete: jest.fn(),
      },
    };

    fsMock.existsSync.mockReturnValue(true);
    fsMock.unlinkSync.mockImplementation(() => undefined);

    const service = new CronService(
      prisma as any,
      { notifyApproversReminder: jest.fn() } as any,
      { execute: jest.fn() } as any,
    );

    await service.cleanupExpiredExports();

    expect(prisma.jobRecord.delete).toHaveBeenCalledWith({
      where: { id: 'job-1' },
    });
  });

  it('cleanupExpiredExports keeps record when file deletion fails', async () => {
    const prisma = {
      jobRecord: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'job-1', result: { filepath: 'exports/file-1.xlsx' } },
          ]),
        delete: jest.fn(),
      },
    };

    fsMock.existsSync.mockReturnValue(true);
    fsMock.unlinkSync.mockImplementation(() => {
      throw new Error('delete failed');
    });

    const service = new CronService(
      prisma as any,
      { notifyApproversReminder: jest.fn() } as any,
      { execute: jest.fn() } as any,
    );

    await service.cleanupExpiredExports();

    expect(prisma.jobRecord.delete).not.toHaveBeenCalled();
  });
});
