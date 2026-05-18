import { Injectable } from '@nestjs/common';
import { SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [total, pending, approved, rejected] = await this.prisma.$transaction([
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
    ]);

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

    const rows = await this.prisma.$queryRaw<Array<{ date: Date; count: number }>>`
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
}

