import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ExportFilterDto } from './dto/export-filter.dto';
import { JobType, JobStatus, Role } from '@prisma/client';

@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('export-queue') private readonly exportQueue: Queue,
  ) {}

  async uploadFile(file: Express.Multer.File, userId: string) {
    return this.prisma.fileRecord.create({
      data: {
        originalName: file.originalname,
        storedName: file.filename,
        storedPath: file.path,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: userId,
      } as any,
    });
  }

  async createExportJob(userId: string, dto: ExportFilterDto) {
    const jobRecord = await this.prisma.jobRecord.create({
      data: {
        type: JobType.EXPORT,
        status: JobStatus.PENDING,
        progress: 0,
        createdBy: userId,
      } as any,
    });

    // Thêm job vào BullMQ queue
    await this.exportQueue.add('EXPORT_SUBMISSIONS', {
      jobId: jobRecord.id,
      formId: dto.formId,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      userId,
    });

    return jobRecord;
  }

  async getJobStatus(jobId: string) {
    const job = await this.prisma.jobRecord.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('job.NOT_FOUND');
    }

    return job;
  }

  async getFileRecord(fileId: string, userId: string, role: string) {
    const fileRecord = await this.prisma.fileRecord.findUnique({
      where: { id: fileId },
    });

    if (!fileRecord) {
      throw new NotFoundException('file.NOT_FOUND');
    }

    // Nếu không phải ADMIN/MANAGER, chỉ được tải file do chính mình upload
    // (Sau này có thể mở rộng logic: nếu file đính kèm với một Submission, 
    // người duyệt submission đó cũng được tải)
    if (role !== Role.ADMIN && role !== Role.MANAGER && fileRecord.uploadedBy !== userId) {
      throw new ForbiddenException('error.FORBIDDEN');
    }

    return fileRecord;
  }
}
