import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAGIC_SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'application/msword', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  // DOCX/XLSX/PPTX are all ZIP-based (PK header)
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes: [0x50, 0x4b, 0x03, 0x04],
  },
];

export async function validateFileMagicBytes(
  filePath: string,
  declaredMimeType: string,
): Promise<void> {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4096);
    fs.readSync(fd, buffer, 0, 4096, 0);

    // Try file-type library (ESM — dynamic import)
    try {
      const { fileTypeFromBuffer } = await (Function(
        'return import("file-type")',
      )() as Promise<typeof import('file-type')>);
      const detected = await fileTypeFromBuffer(buffer);

      if (detected) {
        if (!ALLOWED_MIME_TYPES.includes(detected.mime)) {
          throw new BadRequestException(
            `Invalid file content. Detected: ${detected.mime}`,
          );
        }
        return;
      }
      // file-type returned undefined — can't determine type (e.g., plain text)
    } catch (importError) {
      if (importError instanceof BadRequestException) throw importError;
      // file-type import failed, fall through to manual check
    }

    // Fallback: manual magic-byte check
    for (const sig of MAGIC_SIGNATURES) {
      const sigBuffer = Buffer.from(sig.bytes);
      if (buffer.subarray(0, sigBuffer.length).equals(sigBuffer)) {
        return; // Matches a known allowed type
      }
    }

    throw new BadRequestException(
      `File content does not match any allowed type. Declared: ${declaredMimeType}`,
    );
  } finally {
    fs.closeSync(fd);
  }
}
