import { Injectable } from '@nestjs/common';
import { SubmissionStatus, WorkflowInstanceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [total, pending, approved, rejected] = await this.prisma.$transaction(
      [
        this.prisma.submission.count(),
        this.prisma.submission.count({
          where: { status: SubmissionStatus.UNDER_REVIEW },
        }),
        this.prisma.submission.count({
          where: { status: SubmissionStatus.APPROVED },
        }),
        this.prisma.submission.count({
          where: { status: SubmissionStatus.REJECTED },
        }),
      ],
    );

    return { total, pending, approved, rejected };
  }

  async getMySummary(userId: string) {
    const [total, pending, approved, rejected] = await this.prisma.$transaction(
      [
        this.prisma.submission.count({ where: { submittedBy: userId } }),
        this.prisma.submission.count({
          where: { submittedBy: userId, status: SubmissionStatus.UNDER_REVIEW },
        }),
        this.prisma.submission.count({
          where: { submittedBy: userId, status: SubmissionStatus.APPROVED },
        }),
        this.prisma.submission.count({
          where: { submittedBy: userId, status: SubmissionStatus.REJECTED },
        }),
      ],
    );

    return { total, pending, approved, rejected };
  }

  async getSubmissionsByStatus() {
    const groups = await this.prisma.submission.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return groups.map((group) => ({
      status: group.status,
      count: group._count.id,
    }));
  }

  async getSubmissionsByDay(days: number = 30) {
    const clampedDays = Math.min(Math.max(days, 1), 365);
    const from = new Date();
    from.setDate(from.getDate() - clampedDays);

    const rows = await this.prisma.$queryRaw<
      Array<{ date: Date; count: number }>
    >`
      SELECT DATE(created_at) AS date, COUNT(*)::int AS count
      FROM submissions
      WHERE created_at >= ${from}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;

    return rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }

  async getTopForms(limit: number = 5) {
    const clampedLimit = Math.min(Math.max(limit, 1), 100);
    const groups = await this.prisma.submission.groupBy({
      by: ['formId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: clampedLimit,
    });

    const formIds = groups.map((group) => group.formId);
    const forms = await this.prisma.form.findMany({
      where: { id: { in: formIds } },
      select: { id: true, name: true },
    });

    return groups.map((group) => ({
      formId: group.formId,
      formName: forms.find((form) => form.id === group.formId)?.name ?? null,
      count: group._count.id,
    }));
  }

  async getSlaMetrics(days: number = 30) {
    const clampedDays = Math.min(Math.max(days, 1), 365);
    const from = new Date();
    from.setDate(from.getDate() - clampedDays);

    const instances = await this.prisma.workflowInstance.findMany({
      where: {
        status: {
          in: [WorkflowInstanceStatus.ACTIVE, WorkflowInstanceStatus.COMPLETED],
        },
        updatedAt: { gte: from },
      },
      include: {
        definition: { select: { name: true, config: true } },
        histories: {
          orderBy: { createdAt: 'asc' },
          select: { fromStep: true, toStep: true, createdAt: true },
        },
      },
    });

    const grouped = new Map<
      string,
      {
        slaHours: number;
        definitionName: string;
        step: string;
        durations: number[];
        breached: number;
      }
    >();

    for (const instance of instances) {
      const config = instance.definition.config as any;
      if (!config.statesDetails) continue;

      for (const [step, details] of Object.entries<any>(config.statesDetails)) {
        if (!details.slaHours) continue;

        const key = `${instance.definition.name}::${step}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            slaHours: details.slaHours,
            definitionName: instance.definition.name,
            step,
            durations: [],
            breached: 0,
          });
        }

        const entryRecord = instance.histories.find((h) => h.toStep === step);
        const exitRecord = instance.histories.find(
          (h) => h.fromStep === step && h.toStep !== step,
        );

        if (entryRecord) {
          const entryTime = entryRecord.createdAt.getTime();
          const exitTime = exitRecord
            ? exitRecord.createdAt.getTime()
            : Date.now();
          const durationHours = (exitTime - entryTime) / (1000 * 60 * 60);

          const bucket = grouped.get(key)!;
          bucket.durations.push(durationHours);
          if (durationHours > details.slaHours) {
            bucket.breached++;
          }
        }
      }
    }

    return Array.from(grouped.values()).map((bucket) => {
      const avg =
        bucket.durations.length > 0
          ? bucket.durations.reduce((a, b) => a + b, 0) /
            bucket.durations.length
          : 0;
      return {
        definitionName: bucket.definitionName,
        step: bucket.step,
        slaHours: bucket.slaHours,
        totalInstances: bucket.durations.length,
        breachedCount: bucket.breached,
        complianceRate:
          bucket.durations.length > 0
            ? Math.round(
                ((bucket.durations.length - bucket.breached) /
                  bucket.durations.length) *
                  10000,
              ) / 100
            : 100,
        avgDurationHours: Math.round(avg * 100) / 100,
      };
    });
  }
}
