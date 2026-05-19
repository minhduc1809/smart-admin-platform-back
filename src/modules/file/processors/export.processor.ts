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

      submissions.forEach(s => {
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

      // 4. Lưu file
      const filename = `export-${formId || 'all'}-${Date.now()}.xlsx`;
      const filepath = path.join('exports', filename);
      const fullPath = path.join(process.cwd(), filepath);
      
      await workbook.xlsx.writeFile(fullPath);

      // 5. Hoàn tất job
      await this.prisma.jobRecord.update({
        where: { id: jobId },
        data: { 
          status: JobStatus.DONE, 
          progress: 100,
          result: { filepath },
        },
      });
      await job.updateProgress(100);
      this.eventEmitter.emit('job.progress', { jobId, progress: 100, userId });

      // Phát event real-time (chuẩn bị cho Phase 14)
      this.eventEmitter.emit('job.completed', { jobId, status: 'DONE', userId, filepath });

      return { filepath };
    } catch (error: any) {
      // Xử lý lỗi an toàn
      await this.prisma.jobRecord.update({
        where: { id: jobId },
        data: { 
          status: JobStatus.FAILED, 
          error: error.message || 'Unknown Error',
        },
      });
      this.eventEmitter.emit('job.completed', {
        jobId,
        status: 'FAILED',
        userId,
        error: error.message || 'Unknown Error',
      });
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(`Export Job ${job.id} failed:`, error.message);
  }
}
