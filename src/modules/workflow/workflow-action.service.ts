import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from './workflow.engine';
import { ExecuteActionDto } from './dto/execute-action.dto';
import { WorkflowConfig } from './interfaces/workflow-config.interface';

@Injectable()
export class WorkflowActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(actorId: string, actorRole: string, dto: ExecuteActionDto) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: {
        submissionId: dto.submissionId,
        status: 'ACTIVE',
      },
    });

    if (!instance) {
      throw new NotFoundException('workflow.INSTANCE_NOT_FOUND');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      return await this.workflowEngine.executeAction(
        tx,
        instance.id,
        dto.action,
        actorId,
        actorRole,
        dto.comment,
      );
    });

    this.eventEmitter.emit('workflow.state.changed', {
      submissionId: result.submissionId,
      instanceId: result.instanceId,
      fromState: result.previousState,
      toState: result.currentState,
      action: dto.action,
      actorId,
    });

    if (result.isCompleted) {
      this.eventEmitter.emit('workflow.completed', {
        submissionId: result.submissionId,
        instanceId: result.instanceId,
        finalState: result.currentState,
      });
    }

    return result;
  }

  async getHistory(submissionId: string) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { submissionId },
      include: {
        histories: {
          orderBy: { createdAt: 'asc' as const },
        },
        definition: { select: { name: true, config: true } },
      },
    });

    if (!instance) {
      throw new NotFoundException('workflow.INSTANCE_NOT_FOUND');
    }

    return {
      instanceId: instance.id,
      currentStep: instance.currentStep,
      status: instance.status,
      workflowName: instance.definition.name,
      history: instance.histories,
    };
  }

  async getAvailableActions(submissionId: string, userRole: string) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: {
        submissionId,
        status: 'ACTIVE',
      },
      include: { definition: true },
    });

    if (!instance) {
      return { actions: [] };
    }

    const config = instance.definition.config as unknown as WorkflowConfig;
    const currentState = instance.currentStep;

    const availableActions = config.transitions
      .filter((t) => {
        const stateMatch = t.from === currentState || t.from === '*';
        const roleMatch =
          !t.roles || t.roles.length === 0 || t.roles.includes(userRole);
        return stateMatch && roleMatch;
      })
      .map((t) => ({
        action: t.action,
        targetState: t.to,
        requiresComment: t.conditions?.requireComment || false,
      }));

    return {
      currentState,
      actions: availableActions,
    };
  }
}
