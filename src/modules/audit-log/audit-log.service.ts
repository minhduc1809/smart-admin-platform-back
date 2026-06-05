import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('audit.log', { async: true })
  async handleAuditLogEvent(payload: {
    tenantId: string;
    actorId: string;
    action: string;
    targetModel: string;
    targetId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: payload.tenantId,
          actorId: payload.actorId,
          action: payload.action,
          targetModel: payload.targetModel,
          targetId: payload.targetId,
          oldValues: payload.oldValues || null,
          newValues: payload.newValues || null,
          ipAddress: payload.ipAddress || null,
        },
      });
      this.logger.debug(
        `Audit log recorded for ${payload.targetModel} [${payload.action}] by ${payload.actorId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to record audit log: ${error.message}`,
        error.stack,
      );
    }
  }
}
