import { Module, BadRequestException } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bullmq';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { CloudinaryService } from './cloudinary.service';
import { ExportProcessor } from './processors/export.processor';
import * as fs from 'fs';

@Module({
  imports: [
    // Configure Multer for static upload
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          // Generate secure unique filename
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // docx
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(new BadRequestException('file.INVALID_FORMAT'), false);
        }
        cb(null, true);
      },
    }),
    // Configure BullMQ Queue
    BullModule.registerQueue({
      name: 'export-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  controllers: [FileController],
  providers: [FileService, CloudinaryService, ExportProcessor],
  exports: [FileService, CloudinaryService],
})
export class FileModule {}
