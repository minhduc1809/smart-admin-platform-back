import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      throw new UnauthorizedException('API Key is missing');
    }

    const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');

    // Bypass RLS tenantId injection because we don't have tenantId yet
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyHash },
    });

    if (!apiKey || apiKey.revoked) {
      throw new UnauthorizedException('Invalid or inactive API Key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API Key has expired');
    }

    // Bind context for downstream services
    this.cls.set('tenantId', apiKey.tenantId);
    this.cls.set('userId', 'API_KEY_SYSTEM');
    this.cls.set('apiKeyScopes', apiKey.scopes);
    
    // Set user object on request
    request.user = {
      id: 'API_KEY_SYSTEM',
      tenantId: apiKey.tenantId,
      role: 'API_CLIENT',
      scopes: apiKey.scopes
    };

    return true;
  }
}
