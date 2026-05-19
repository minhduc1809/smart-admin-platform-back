import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { WorkflowConfig } from './interfaces/workflow-config.interface';

@Injectable()
export class WorkflowDefinitionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkflowDefinitionDto) {
    this.validateConfig(dto.config as unknown as WorkflowConfig);

    return this.prisma.workflowDefinition.create({
      data: {
        name: dto.name,
        formId: dto.formId,
        config: dto.config,
        createdBy: userId,
      } as any,
    });
  }

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workflowDefinition.findMany({
        include: { form: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.workflowDefinition.count(),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const definition = await this.prisma.workflowDefinition.findUnique({
      where: { id },
      include: { form: { select: { id: true, name: true } } },
    });

    if (!definition) {
      throw new NotFoundException('workflow.DEFINITION_NOT_FOUND');
    }

    return definition;
  }

  async update(id: string, dto: UpdateWorkflowDefinitionDto) {
    await this.findOne(id);

    if (dto.config) {
      this.validateConfig(dto.config as unknown as WorkflowConfig);
    }

    return this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.formId !== undefined && { formId: dto.formId }),
        ...(dto.config && { config: dto.config }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const activeInstances = await this.prisma.workflowInstance.count({
      where: { definitionId: id, status: 'ACTIVE' },
    });

    if (activeInstances > 0) {
      throw new ConflictException('error.CONFLICT');
    }

    return this.prisma.workflowDefinition.delete({ where: { id } });
  }

  validateConfig(config: WorkflowConfig): void {
    if (
      !config.states ||
      !Array.isArray(config.states) ||
      config.states.length === 0
    ) {
      throw new BadRequestException(
        'Workflow config must have at least one state',
      );
    }

    const stateSet = new Set(config.states);
    if (stateSet.size !== config.states.length) {
      throw new BadRequestException('Workflow states must be unique');
    }

    if (!config.initialState || !config.states.includes(config.initialState)) {
      throw new BadRequestException(
        'initialState must be one of the defined states',
      );
    }

    if (
      !config.finalStates ||
      !Array.isArray(config.finalStates) ||
      config.finalStates.length === 0
    ) {
      throw new BadRequestException(
        'Workflow config must have at least one finalState',
      );
    }

    for (const fs of config.finalStates) {
      if (!config.states.includes(fs)) {
        throw new BadRequestException(
          `finalState "${fs}" is not in the states list`,
        );
      }
    }

    if (
      !config.transitions ||
      !Array.isArray(config.transitions) ||
      config.transitions.length === 0
    ) {
      throw new BadRequestException(
        'Workflow config must have at least one transition',
      );
    }

    for (const t of config.transitions) {
      const fromValues = Array.isArray(t.from) ? t.from : [t.from];
      for (const fromState of fromValues) {
        if (fromState !== '*' && !config.states.includes(fromState)) {
          throw new BadRequestException(
            `Transition from "${fromState}" references an undefined state`,
          );
        }
      }
      if (!config.states.includes(t.to)) {
        throw new BadRequestException(
          `Transition to "${t.to}" references an undefined state`,
        );
      }
      if (!t.action) {
        throw new BadRequestException('Each transition must have an action');
      }
    }
  }
}
