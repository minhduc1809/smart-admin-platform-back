import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationEngine, FormSchema } from '../form/validation.engine';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionFilterDto } from './dto/submission-filter.dto';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { FilterUtil } from '../../common/utils/filter.util';
import { SubmissionStatus } from '@prisma/client';

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
    const errors = this.validationEngine.validate(form.schema as unknown as FormSchema, dto.data);
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
          status: SubmissionStatus.SUBMITTED, // Depending on workflow, it might start as SUBMITTED or UNDER_REVIEW
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
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where = FilterUtil.buildPrismaWhere({
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
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where = FilterUtil.buildPrismaWhere({
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

    if (role !== 'ADMIN' && role !== 'MANAGER' && submission.submittedBy !== userId) {
      throw new ForbiddenException('error.FORBIDDEN');
    }

    return submission;
  }

  async recall(id: string, userId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('submission.NOT_FOUND');
    }

    if (submission.submittedBy !== userId) {
      throw new ForbiddenException('error.FORBIDDEN');
    }

    if (submission.status !== SubmissionStatus.DRAFT && submission.status !== SubmissionStatus.SUBMITTED) {
      throw new ForbiddenException('workflow.NOT_ALLOWED');
    }

    return this.prisma.submission.update({
      where: { id },
      data: { status: SubmissionStatus.DRAFT },
    });
  }
}
