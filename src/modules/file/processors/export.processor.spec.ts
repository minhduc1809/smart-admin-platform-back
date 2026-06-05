import { JobStatus } from '@prisma/client';
import { ExportProcessor } from './export.processor';

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    addWorksheet: jest.fn(() => ({
      columns: [],
      addRow: jest.fn(),
    })),
    xlsx: {
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
  })),
}));

describe('ExportProcessor', () => {
  let prisma: any;
  let eventEmitter: any;
  let processor: ExportProcessor;

  beforeEach(() => {
    prisma = {
      jobRecord: {
        update: jest.fn(),
      },
      submission: {
        findMany: jest.fn(),
      },
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    processor = new ExportProcessor(prisma, eventEmitter, {
      uploadExport: jest.fn(),
    } as any);
  });

  it('process updates job status and emits completion', async () => {
    prisma.jobRecord.update.mockResolvedValue({});
    prisma.submission.findMany.mockResolvedValue([]);

    const job = {
      data: {
        jobId: 'job-1',
        formId: 'form-1',
        fromDate: '2024-01-01',
        toDate: '2024-01-31',
        userId: 'user-1',
      },
      updateProgress: jest.fn(),
    } as any;

    const result = await processor.process(job);

    expect(prisma.jobRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: JobStatus.DONE }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'job.progress',
      expect.objectContaining({
        jobId: 'job-1',
      }),
    );
    expect(result.filepath).toContain('exports');
    expect(result.filepath).toContain('.xlsx');
  });
});
