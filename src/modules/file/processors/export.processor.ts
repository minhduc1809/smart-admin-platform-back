import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SubmissionStatus, JobStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CloudinaryService } from '../cloudinary.service';

interface ExportJobPayload {
  jobId: string;
  formId?: string;
  fromDate?: string;
  toDate?: string;
  userId: string;
}

@Processor('export-queue')
@Injectable()
export class ExportProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    super();
  }

  // Chạy sau khi module đã khởi tạo xong — an toàn hơn constructor
  onModuleInit() {
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
  }

  async process(job: Job<ExportJobPayload>) {
    const { jobId, formId, fromDate, toDate, userId } = job.data;

    try {
      // 1. Cập nhật trạng thái thành PROCESSING
      await this.prisma.jobRecord.update({
        where: { id: jobId },
        data: { status: JobStatus.PROCESSING, progress: 10 },
      });
      await job.updateProgress(10);
      this.eventEmitter.emit('job.progress', { jobId, progress: 10, userId });

      // 2. Lấy dữ liệu
      const whereClause: any = {
        status: SubmissionStatus.APPROVED,
      };

      if (formId) {
        whereClause.formId = formId;
      }

      if (fromDate || toDate) {
        whereClause.createdAt = {};
        if (fromDate) whereClause.createdAt.gte = new Date(fromDate);
        if (toDate) whereClause.createdAt.lte = new Date(toDate);
      }

      const submissions = await this.prisma.submission.findMany({
        where: whereClause,
        include: {
          user: true,
          form: true,
        },
      });

      await this.prisma.jobRecord.update({
        where: { id: jobId },
        data: { progress: 40 },
      });
      await job.updateProgress(40);
      this.eventEmitter.emit('job.progress', { jobId, progress: 40, userId });

      // 3. Tạo workbook Excel
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Submissions');

      sheet.columns = [
        { header: 'Tên Form', key: 'formName', width: 25 },
        { header: 'Người nộp (Email)', key: 'email', width: 30 },
        { header: 'Ngày nộp', key: 'date', width: 20 },
        { header: 'Dữ liệu', key: 'data', width: 50 },
      ];

      submissions.forEach((s) => {
        sheet.addRow({
          formName: s.form.name,
          email: s.user.email,
          date: s.createdAt.toISOString(),
          data: JSON.stringify(s.data),
        });
      });

      await this.prisma.jobRecord.update({
        where: { id: jobId },
        data: { progress: 80 },
      });
      await job.updateProgress(80);
      this.eventEmitter.emit('job.progress', { jobId, progress: 80, userId });

      // 4. Upload to Cloudinary
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      // Build meaningful filename: export-{formName}-{timestamp}
      let formName = 'all';
      if (formId) {
        const form = await this.prisma.form.findUnique({
          where: { id: formId },
          select: { name: true },
        });
        if (form) {
          formName = form.name
            .toLowerCase()
            .replace(/[^a-z0-9À-ɏ]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 40);
        }
      }
      const filename = `export-${formName}`;

      let fileUrl: string;
      try {
        const uploadResult = await this.cloudinaryService.uploadExport(
          buffer,
          filename,
        );
        fileUrl = uploadResult.url;
      } catch {
        const localPath = path.join(
          'exports',
          `${filename}-${Date.now()}.xlsx`,
        );
        const fullPath = path.join(process.cwd(), localPath);
        await workbook.xlsx.writeFile(fullPath);
        fileUrl = localPath;
      }

      // 5. Hoàn tất job
      await this.prisma.jobRecord.update({
        where: { id: jobId },
        data: {
          status: JobStatus.DONE,
          progress: 100,
          result: { filepath: fileUrl, url: fileUrl },
        },
      });
      await job.updateProgress(100);
      this.eventEmitter.emit('job.progress', { jobId, progress: 100, userId });

      this.eventEmitter.emit('job.completed', {
        jobId,
        status: 'DONE',
        userId,
        filepath: fileUrl,
      });

      return { filepath: fileUrl };
    } catch (error: any) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade >= maxAttempts - 1;
      const errorMessage = error.message || 'Unknown Error';

      if (isFinalAttempt) {
        await this.prisma.jobRecord.update({
          where: { id: jobId },
          data: {
            status: JobStatus.FAILED,
            error: errorMessage,
          },
        });
        this.eventEmitter.emit('job.completed', {
          jobId,
          status: 'FAILED',
          userId,
          error: errorMessage,
        });
      } else {
        await this.prisma.jobRecord.update({
          where: { id: jobId },
          data: {
            error: `Attempt ${job.attemptsMade + 1}/${maxAttempts} failed: ${errorMessage}`,
          },
        });
      }
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(`Export Job ${job.id} failed:`, error.message);
  }
}
