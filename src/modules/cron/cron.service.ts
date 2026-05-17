import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { JobStatus, JobType, WorkflowInstanceStatus } from '@prisma/client';
import * as fs from 'fs';

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

    for (const job of doneExports) {
      const result = job.result as { filepath?: string } | null;
      const filepath = result?.filepath;

      if (filepath && fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      await this.prisma.jobRecord.delete({
        where: { id: job.id },
      });
    }

    this.logger.log(`Cleaned ${doneExports.length} expired export jobs.`);
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
}

