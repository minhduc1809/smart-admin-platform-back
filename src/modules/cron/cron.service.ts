import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { WorkflowActionService } from '../workflow/workflow-action.service';
import { JobStatus, JobType, WorkflowInstanceStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type WorkflowConfig = {
  transitions?: Array<{
    from: string | string[];
    roles?: string[];
  }>;
};

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly workflowActionService: WorkflowActionService,
  ) {}

  @Cron('0 0 * * *', {
    name: 'cleanup-exports',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async cleanupExpiredExports() {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 7);

    const doneExports = await this.prisma.jobRecord.findMany({
      where: {
        type: JobType.EXPORT,
        status: JobStatus.DONE,
        updatedAt: { lte: threshold },
      },
      select: { id: true, result: true },
    });

    let cleaned = 0;
    let deleteFailures = 0;

    for (const job of doneExports) {
      const result = job.result as { filepath?: string } | null;
      const filepath = result?.filepath;
      let shouldDeleteRecord = true;

      if (filepath) {
        const fullPath = path.isAbsolute(filepath)
          ? filepath
          : path.join(process.cwd(), filepath);

        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (error) {
            shouldDeleteRecord = false;
            deleteFailures += 1;
            this.logger.error(
              `Failed to delete export file: ${fullPath}`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        }
      }

      if (shouldDeleteRecord) {
        await this.prisma.jobRecord.delete({
          where: { id: job.id },
        });
        cleaned += 1;
      }
    }

    this.logger.log(`Cleaned ${cleaned} expired export jobs.`);
    if (deleteFailures > 0) {
      this.logger.warn(`Failed to delete ${deleteFailures} export files.`);
    }
  }

  @Cron('0 2 * * *', {
    name: 'cleanup-expired-refresh-tokens',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async cleanupExpiredRefreshTokens() {
    const deleted = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (deleted.count > 0) {
      this.logger.log(`Cleaned up ${deleted.count} expired refresh tokens.`);
    }
  }

  @Cron('0 * * * *', {
    name: 'remind-pending',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async remindPendingApprovals() {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - 24);

    const staleInstances = await this.prisma.workflowInstance.findMany({
      where: {
        status: WorkflowInstanceStatus.ACTIVE,
        updatedAt: { lte: threshold },
      },
      include: {
        definition: { select: { config: true } },
        submission: { include: { form: { select: { name: true } } } },
      },
    });

    let reminders = 0;
    for (const instance of staleInstances) {
      const config = instance.definition.config as unknown as WorkflowConfig;
      const roles = new Set<string>();

      for (const transition of config.transitions ?? []) {
        const fromMatch = Array.isArray(transition.from)
          ? transition.from.includes(instance.currentStep)
          : transition.from === instance.currentStep || transition.from === '*';

        if (!fromMatch) continue;
        for (const role of transition.roles ?? []) {
          roles.add(role);
        }
      }

      if (!roles.size) continue;

      const result = await this.notificationService.notifyApproversReminder(
        instance.submissionId,
        Array.from(roles),
        instance.submission.form.name,
      );
      reminders += result.sent;
    }

    this.logger.log(
      `Sent ${reminders} reminders for ${staleInstances.length} stale workflow instances.`,
    );
  }

  @Cron('*/30 * * * *', {
    name: 'workflow-sla-check',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async checkWorkflowSLA() {
    const now = new Date();

    const activeInstances = await this.prisma.workflowInstance.findMany({
      where: { status: WorkflowInstanceStatus.ACTIVE },
      include: {
        definition: { select: { config: true } },
      },
    });

    for (const instance of activeInstances) {
      const config = instance.definition.config as any;
      if (!config.statesDetails) continue;

      const stateDetail = config.statesDetails[instance.currentStep];
      if (!stateDetail || !stateDetail.slaHours || !stateDetail.timeoutAction)
        continue;

      const expirationDate = this.addBusinessHours(
        instance.updatedAt,
        stateDetail.slaHours,
      );
      if (now >= expirationDate) {
        this.logger.log(
          `WorkflowInstance ${instance.id} at step ${instance.currentStep} exceeded SLA of ${stateDetail.slaHours} hours. Executing timeout action ${stateDetail.timeoutAction}`,
        );

        let botUser = await this.prisma.user.findFirst({
          where: { username: 'system_bot' },
        });

        if (!botUser) {
          const firstTenant = await this.prisma.tenant.findFirst();
          if (firstTenant) {
            botUser = await this.prisma.user.create({
              data: {
                tenantId: firstTenant.id,
                username: 'system_bot',
                email: 'system_bot@workflow.system',
                role: 'ADMIN',
                isActive: true,
              },
            });
          }
        }

        if (botUser) {
          try {
            await this.workflowActionService.execute(botUser.id, botUser.role, {
              submissionId: instance.submissionId,
              action: stateDetail.timeoutAction,
              comment: `Auto-escalation due to SLA timeout (${stateDetail.slaHours}h)`,
            });
          } catch (err) {
            this.logger.error(
              `Failed to execute SLA timeout action for instance ${instance.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    }
  }

  private addBusinessHours(startDate: Date, hours: number): Date {
    const result = new Date(startDate);
    let hoursRemaining = hours;

    while (hoursRemaining > 0) {
      result.setHours(result.getHours() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) {
        hoursRemaining--;
      }
    }
    return result;
  }
}
