import {
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Body,
  UseGuards,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { ExportFilterDto } from './dto/export-filter.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, JobStatus } from '@prisma/client';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file (max 10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|pdf|doc|docx)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.fileService.uploadFile(file, userId);
  }

  // --- Export routes must come BEFORE /:id to avoid route conflict ---

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Tạo job xuất file Excel (Bất đồng bộ) — trả về 202 Accepted' })
  async exportSubmissions(
    @CurrentUser('id') userId: string,
    @Body() dto: ExportFilterDto,
  ) {
    return this.fileService.createExportJob(userId, dto);
  }

  @Get('export/:jobId')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Kiểm tra tiến độ export job' })
  async getExportStatus(@Param('jobId') jobId: string) {
    return this.fileService.getJobStatus(jobId);
  }

  @Get('export/:jobId/download')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Tải file Excel khi export job đã hoàn thành' })
  async downloadExportedFile(
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const job = await this.fileService.getJobStatus(jobId);

    if (job.status !== JobStatus.DONE || !job.result) {
      throw new NotFoundException('job.NOT_DONE');
    }

    const result = job.result as { filepath: string };
    const fullPath = join(process.cwd(), result.filepath);

    if (!existsSync(fullPath)) {
      throw new NotFoundException('file.PHYSICAL_NOT_FOUND');
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''export-${job.id}.xlsx`);
    
    const fileStream = createReadStream(fullPath);
    fileStream.pipe(res);
  }

  // --- Generic /:id route MUST be last to not shadow specific routes above ---

  @Get(':id')
  @ApiOperation({ summary: 'Download an uploaded file by ID' })
  async downloadUploadedFile(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const fileRecord = await this.fileService.getFileRecord(id, user.id, user.role);
    
    // Check if physical file exists
    const fullPath = join(process.cwd(), fileRecord.storedPath);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('file.PHYSICAL_NOT_FOUND');
    }

    // RFC 5987 encoding for Unicode filenames
    const encodedName = encodeURIComponent(fileRecord.originalName);
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    
    const fileStream = createReadStream(fullPath);
    fileStream.pipe(res);
  }
}
