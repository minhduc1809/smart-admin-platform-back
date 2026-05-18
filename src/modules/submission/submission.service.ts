import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationEngine, FormSchema } from '../form/validation.engine';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionFilterDto } from './dto/submission-filter.dto';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { FilterUtil } from '../../common/utils/filter.util';
import { SubmissionStatus, Role } from '@prisma/client';

@Injectable()
export class SubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationEngine: ValidationEngine,
    private readonly workflowEngine: WorkflowEngine,
  ) {}

  async create(userId: string, dto: CreateSubmissionDto) {
    // 1. Fetch form schema
    const form = await this.prisma.form.findUnique({
      where: { id: dto.formId, isActive: true },
    });

    if (!form) {
      throw new NotFoundException('form.NOT_FOUND');
    }

    // 2. Validate data via ValidationEngine
    const errors = this.validationEngine.validate(
      form.schema as unknown as FormSchema,
      dto.data,
    );
    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: 'validation.INVALID',
        errors,
      });
    }

    // 3. Fetch workflow config for the form
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { formId: dto.formId },
    });

    // 4. Save submission + initiate workflow (in a transaction)
    const submission = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.submission.create({
        data: {
          formId: dto.formId,
          submittedBy: userId,
          data: dto.data,
          status: workflow
            ? SubmissionStatus.UNDER_REVIEW
            : SubmissionStatus.SUBMITTED,
        },
      });

      if (workflow) {
        await this.workflowEngine.initiate(tx, sub.id, workflow);
      }

      return sub;
    });

    return submission;
  }

  async findMySubmissions(userId: string, dto: SubmissionFilterDto) {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.max(1, dto.limit ?? 20);

    const where = this.buildWhere({
      submittedBy: userId,
      status: dto.status,
      formId: dto.formId,
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where,
        include: { form: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.submission.count({ where }),
    ]);

    return {
      items: data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(dto: SubmissionFilterDto) {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.max(1, dto.limit ?? 20);

    const where = this.buildWhere({
      status: dto.status,
      formId: dto.formId,
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where,
        include: {
          form: { select: { name: true } },
          user: { select: { email: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.submission.count({ where }),
    ]);

    return {
      items: data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private buildWhere(filters: any) {
    const where = FilterUtil.buildPrismaWhere(filters);
    // FilterUtil.buildPrismaWhere might include deletedAt: null by default 
    // depending on its implementation, but we want to be explicit here if needed.
    // The previous code was:
    // const where = FilterUtil.buildPrismaWhere(filters);
    // delete where.deletedAt;
    // This suggests FilterUtil.buildPrismaWhere adds it.
    
    // To be safe and less fragile as requested in #10:
    if (where.hasOwnProperty('deletedAt')) {
      delete where.deletedAt;
    }
    return where;
  }

  async findOne(id: string, userId: string, role: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        form: { select: { name: true, schema: true } },
        user: { select: { email: true, username: true } },
        workflows: {
          include: { histories: true },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('submission.NOT_FOUND');
    }

    if (
      role !== Role.ADMIN &&
      role !== Role.MANAGER &&
      submission.submittedBy !== userId
    ) {
      throw new ForbiddenException('error.FORBIDDEN');
    }

    return submission;
  }

  async recall(id: string, userId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: { workflows: { where: { status: 'ACTIVE' } } },
    });

    if (!submission) {
      throw new NotFoundException('submission.NOT_FOUND');
    }

    if (submission.submittedBy !== userId) {
      throw new ForbiddenException('error.FORBIDDEN');
    }

    if (
      submission.status !== SubmissionStatus.DRAFT &&
      submission.status !== SubmissionStatus.SUBMITTED &&
      submission.status !== SubmissionStatus.UNDER_REVIEW
    ) {
      throw new ForbiddenException('workflow.NOT_ALLOWED');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const wf of submission.workflows) {
        await tx.workflowInstance.update({
          where: { id: wf.id },
          data: { status: 'CANCELLED' },
        });
      }

      return tx.submission.update({
        where: { id },
        data: { status: SubmissionStatus.DRAFT },
      });
    });
  }

  async resubmit(
    userId: string,
    originalSubmissionId: string,
    newData?: Record<string, any>,
  ) {
    const original = await this.prisma.submission.findUnique({
      where: { id: originalSubmissionId },
      include: {
        form: true,
        workflows: { where: { status: 'ACTIVE' } },
      },
    });

    if (!original) {
      throw new NotFoundException('submission.NOT_FOUND');
    }

    if (original.submittedBy !== userId) {
      throw new ForbiddenException('error.FORBIDDEN');
    }

    const resubmittableStatuses: SubmissionStatus[] = [
      SubmissionStatus.REJECTED,
      SubmissionStatus.CANCELLED,
      SubmissionStatus.RETURNED,
    ];
    if (!resubmittableStatuses.includes(original.status)) {
      throw new BadRequestException('submission.CANNOT_RESUBMIT');
    }

    const data = newData ?? (original.data as Record<string, any>);

    const errors = this.validationEngine.validate(
      original.form.schema as unknown as FormSchema,
      data,
    );
    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: 'validation.INVALID',
        errors,
      });
    }

    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { formId: original.formId },
    });

    const submission = await this.prisma.$transaction(async (tx) => {
      // Complete any active workflow instances on the original (returned_for_edit case)
      for (const wf of original.workflows) {
        await tx.workflowInstance.update({
          where: { id: wf.id },
          data: { status: 'COMPLETED' },
        });
      }

      const sub = await tx.submission.create({
        data: {
          formId: original.formId,
          submittedBy: userId,
          data,
          status: workflow
            ? SubmissionStatus.UNDER_REVIEW
            : SubmissionStatus.SUBMITTED,
          parentSubmissionId: original.id,
          revisionNumber: original.revisionNumber + 1,
        },
      });

      if (workflow) {
        await this.workflowEngine.initiate(tx, sub.id, workflow);
      }

      return sub;
    });

    return submission;
  }

  async getRevisions(id: string, userId: string, role: string) {
    // Walk up to find root (with cycle detection)
    const ancestors = await this.prisma.submission.findMany({
      where: { id },
      select: { id: true, parentSubmissionId: true, submittedBy: true },
    });

    let current = ancestors[0];
    if (!current) throw new NotFoundException('submission.NOT_FOUND');

    const visited = new Set<string>([current.id]);
    while (current?.parentSubmissionId) {
      if (visited.has(current.parentSubmissionId)) break;
      visited.add(current.parentSubmissionId);
      const parent = await this.prisma.submission.findUnique({
        where: { id: current.parentSubmissionId },
        select: { id: true, parentSubmissionId: true, submittedBy: true },
      });
      if (!parent) break;
      current = parent;
    }

    const rootId = current.id;

    // Collect all descendant IDs in batches instead of one-by-one
    const allIds: string[] = [rootId];
    let frontier = [rootId];
    while (frontier.length > 0) {
      const children = await this.prisma.submission.findMany({
        where: { parentSubmissionId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id);
      allIds.push(...frontier);
    }

    // Fetch all revisions with workflow data in one query
    const revisions = await this.prisma.submission.findMany({
      where: { id: { in: allIds } },
      include: {
        workflows: {
          select: { currentStep: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { revisionNumber: 'asc' },
    });

    // Authorization check
    if (role !== Role.ADMIN && role !== Role.MANAGER) {
      const unauthorized = revisions.some((s) => s.submittedBy !== userId);
      if (unauthorized) throw new ForbiddenException('error.FORBIDDEN');
    }

    return revisions;
  }
}
