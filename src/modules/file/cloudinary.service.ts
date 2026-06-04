import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

/**
 * Cloudinary folder structure:
 *   flowform/
 *     avatars/
 *       {userId}/          ← each user has own folder
 *         avatar.webp
 *     exports/
 *       2026-05-31_export-don-xin-nghi-phep.xlsx
 */
@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `flowform/avatars/${userId}`,
            public_id: 'avatar',
            overwrite: true,
            resource_type: 'image',
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result: UploadApiResponse | undefined) => {
            if (error || !result) {
              reject(
                new BadRequestException(error?.message || 'Upload failed'),
              );
              return;
            }
            resolve({ url: result.secure_url, publicId: result.public_id });
          },
        )
        .end(file.buffer);
    });
  }

  async uploadExport(
    buffer: Buffer,
    fileName: string,
  ): Promise<{ url: string; publicId: string }> {
    const today = new Date().toISOString().slice(0, 10);
    const publicId = `${today}_${fileName}`;

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: 'flowform/exports',
            public_id: publicId,
            resource_type: 'raw',
            format: 'xlsx',
          },
          (error, result: UploadApiResponse | undefined) => {
            if (error || !result) {
              reject(
                new BadRequestException(
                  error?.message || 'Export upload failed',
                ),
              );
              return;
            }
            resolve({ url: result.secure_url, publicId: result.public_id });
          },
        )
        .end(buffer);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch {
      // silent
    }
  }
}
