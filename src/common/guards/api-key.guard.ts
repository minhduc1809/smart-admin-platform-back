import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader) {
      throw new UnauthorizedException('API Key is missing');
    }

    // Bypass RLS tenantId injection because we don't have tenantId yet, and key is globally unique
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key: apiKeyHeader },
    });

    if (!apiKey || !apiKey.isActive) {
      throw new UnauthorizedException('Invalid or inactive API Key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API Key has expired');
    }

    // Update last used asynchronously. We cast where to any to bypass RLS tenant injection in Prisma middleware
    this.prisma.apiKey.update({
      where: { id: apiKey.id } as any,
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    // Bind context for downstream services
    this.cls.set('tenantId', apiKey.tenantId);
    this.cls.set('userId', apiKey.createdBy);
    this.cls.set('apiKeyScopes', apiKey.scopes);
    
    // Set user object on request
    request.user = {
      id: apiKey.createdBy,
      tenantId: apiKey.tenantId,
      role: 'API_CLIENT',
      scopes: apiKey.scopes
    };

    return true;
  }
}
