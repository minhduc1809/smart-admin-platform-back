import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { ClsService } from 'nestjs-cls';
import { ApiKeyDto } from './dto/api-key.dto';

@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService, private cls: ClsService) {}

  async createApiKey(dto: ApiKeyDto) {
    const key = `sk_${randomBytes(24).toString('hex')}`;
    const userId = this.cls.get('userId');

    return this.prisma.apiKey.create({
      data: {
        name: dto.name,
        key,
        scopes: dto.scopes,
        expiresAt: dto.expiresAt,
        createdBy: userId || 'SYSTEM',
      } as any,
    });
  }

  async listApiKeys() {
    return this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async revokeApiKey(id: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('api_key.NOT_FOUND');

    return this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false }
    });
  }
}
