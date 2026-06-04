import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import { ClsService } from 'nestjs-cls';
import { ApiKeyDto } from './dto/api-key.dto';

@Injectable()
export class ApiKeyService {
  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
  ) {}

  async createApiKey(dto: ApiKeyDto) {
    const key = `sk_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash,
        scopes: dto.scopes ? JSON.stringify(dto.scopes) : null,
        expiresAt: dto.expiresAt,
      } as any,
    });

    return { ...apiKey, key }; // return raw key only once
  }

  async listApiKeys() {
    return this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(id: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } as any });
    if (!key) throw new NotFoundException('api_key.NOT_FOUND');

    return this.prisma.apiKey.update({
      where: { id } as any,
      data: { revoked: true } as any,
    });
  }
}
