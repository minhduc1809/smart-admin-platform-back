import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JobStatus, JobType, Role } from '@prisma/client';
import { FileService } from './file.service';

describe('FileService', () => {
  let service: FileService;
  let prisma: any;
  let queue: any;

  beforeEach(() => {
    prisma = {
      fileRecord: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      jobRecord: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
      },
    };

    queue = {
      add: jest.fn(),
    };

    service = new FileService(prisma, queue);
  });

  it('createExportJob creates a job and enqueues it', async () => {
    prisma.jobRecord.create.mockResolvedValue({ id: 'job-1' });

    const result = await service.createExportJob('user-1', {
      formId: 'form-1',
      fromDate: '2024-01-01',
      toDate: '2024-01-31',
    });

    expect(prisma.jobRecord.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        type: JobType.EXPORT,
        status: JobStatus.PENDING,
        progress: 0,
        createdBy: 'user-1',
      },
    });
    expect(queue.add).toHaveBeenCalledWith('EXPORT_SUBMISSIONS', {
      jobId: 'job-1',
      formId: 'form-1',
      fromDate: '2024-01-01',
      toDate: '2024-01-31',
      userId: 'user-1',
    });
    expect(result).toEqual({ id: 'job-1' });
  });

  it('getJobStatus throws when job is missing', async () => {
    prisma.jobRecord.findUnique.mockResolvedValue(null);

    await expect(service.getJobStatus('job-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getFileRecord forbids non-owner access', async () => {
    prisma.fileRecord.findUnique.mockResolvedValue({
      id: 'file-1',
      uploadedBy: 'owner-1',
    });

    await expect(
      service.getFileRecord('file-1', 'user-2', Role.USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
