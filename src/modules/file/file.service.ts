import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ExportFilterDto } from './dto/export-filter.dto';
import { JobType, JobStatus, Role } from '@prisma/client';
import { validateFileMagicBytes } from '../../common/utils/file-validation.util';
import * as fs from 'fs';

@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('export-queue') private readonly exportQueue: Queue,
  ) {}

  async updateUserAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { picture: avatarUrl },
      select: { id: true, picture: true },
    });
  }

  async uploadFile(file: Express.Multer.File, userId: string) {
    try {
      await validateFileMagicBytes(file.path, file.mimetype);
    } catch (error) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });
    return this.prisma.fileRecord.create({
      data: {
        tenantId: user!.tenantId,
        originalName: file.originalname,
        storedName: file.filename,
        storedPath: file.path,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: userId,
      },
    });
  }

  async createExportJob(userId: string, dto: ExportFilterDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });
    const jobRecord = await this.prisma.jobRecord.create({
      data: {
        tenantId: user!.tenantId,
        type: JobType.EXPORT,
        status: JobStatus.PENDING,
        progress: 0,
        createdBy: userId,
        result: {
          params: {
            formId: dto.formId,
            fromDate: dto.fromDate,
            toDate: dto.toDate,
          },
        },
      },
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
    if (
      role !== Role.ADMIN &&
      role !== Role.MANAGER &&
      fileRecord.uploadedBy !== userId
    ) {
      throw new ForbiddenException('error.FORBIDDEN');
    }

    return fileRecord;
  }

  async retryExportJob(jobId: string, userId: string, role: string) {
    const job = await this.prisma.jobRecord.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('job.NOT_FOUND');
    }

    if (job.status !== JobStatus.FAILED) {
      throw new BadRequestException('job.NOT_FAILED');
    }

    if (
      role !== Role.ADMIN &&
      role !== Role.MANAGER &&
      job.createdBy !== userId
    ) {
      throw new ForbiddenException('error.FORBIDDEN');
    }

    const result = job.result as {
      params?: { formId?: string; fromDate?: string; toDate?: string };
    } | null;
    const params = result?.params ?? {};

    await this.prisma.jobRecord.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PENDING,
        progress: 0,
        error: null,
        result: { params },
      },
    });

    await this.exportQueue.add('EXPORT_SUBMISSIONS', {
      jobId: job.id,
      formId: params.formId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      userId: job.createdBy,
    });

    return { message: 'Job re-queued', jobId: job.id };
  }
}
