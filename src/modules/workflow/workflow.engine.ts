import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubmissionStatus } from '@prisma/client';
import {
  WorkflowConfig,
  WorkflowTransition,
} from './interfaces/workflow-config.interface';

@Injectable()
export class WorkflowEngine {
  async initiate(
    tx: Prisma.TransactionClient,
    submissionId: string,
    workflowDefinition: { id: string; config: any },
    context: { tenantId: string; submittedBy: string },
  ) {
    const config = workflowDefinition.config as WorkflowConfig;

    const instance = await tx.workflowInstance.create({
      data: {
        tenantId: context.tenantId,
        definitionId: workflowDefinition.id,
        submissionId,
        currentStep: config.initialState,
        status: 'ACTIVE',
      },
    });

    await tx.workflowHistory.create({
      data: {
        tenantId: context.tenantId,
        instanceId: instance.id,
        fromStep: null,
        toStep: config.initialState,
        action: 'SUBMIT',
        actorId: context.submittedBy,
      },
    });

    return instance;
  }

  async executeAction(
    tx: Prisma.TransactionClient,
    instanceId: string,
    action: string,
    actorId: string,
    actorRole: string,
    comment?: string,
  ) {
    const instance = await tx.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { definition: true },
    });

    if (!instance) {
      throw new NotFoundException('workflow.INSTANCE_NOT_FOUND');
    }

    if (instance.status !== 'ACTIVE') {
      throw new BadRequestException('workflow.INVALID_TRANSITION');
    }

    const config = instance.definition.config as unknown as WorkflowConfig;
    const currentState = instance.currentStep;

    const transition = this.findTransition(config, currentState, action);
    if (!transition) {
      throw new BadRequestException('workflow.INVALID_TRANSITION');
    }

    this.validatePermission(transition, actorRole);

    if (transition.conditions?.requireComment && !comment) {
      throw new BadRequestException('workflow.COMMENT_REQUIRED');
    }

    const newState = transition.to;
    const isNowCompleted = this.isCompleted(config, newState);

    await tx.workflowInstance.update({
      where: { id: instanceId },
      data: {
        currentStep: newState,
        status: isNowCompleted ? 'COMPLETED' : 'ACTIVE',
      },
    });

    await tx.workflowHistory.create({
      data: {
        tenantId: instance.tenantId,
        instanceId,
        fromStep: currentState,
        toStep: newState,
        action,
        actorId,
        comment,
      },
    });

    // Sync submission status
    const submissionStatus = this.mapToSubmissionStatus(config, newState, transition);
    await tx.submission.update({
      where: { id: instance.submissionId },
      data: { status: submissionStatus },
    });

    return {
      instanceId,
      previousState: currentState,
      currentState: newState,
      action,
      isCompleted: isNowCompleted,
      submissionId: instance.submissionId,
    };
  }

  findTransition(
    config: WorkflowConfig,
    currentState: string,
    action: string,
  ): WorkflowTransition | null {
    return (
      config.transitions.find((t) => {
        const fromMatch = Array.isArray(t.from)
          ? t.from.includes(currentState)
          : t.from === currentState || t.from === '*';
        return fromMatch && t.action === action;
      }) || null
    );
  }

  validatePermission(transition: WorkflowTransition, actorRole: string): void {
    if (!transition.roles || transition.roles.length === 0) {
      throw new ForbiddenException('workflow.NOT_ALLOWED');
    }
    if (!transition.roles.includes(actorRole)) {
      throw new ForbiddenException('workflow.NOT_ALLOWED');
    }
  }

  isCompleted(config: WorkflowConfig, state: string): boolean {
    return config.finalStates.includes(state);
  }

  private mapToSubmissionStatus(
    config: WorkflowConfig,
    state: string,
    transition?: WorkflowTransition,
  ): SubmissionStatus {
    if (transition?.submissionStatus) {
      return transition.submissionStatus;
    }

    if (config.statusMapping && config.statusMapping[state]) {
      return config.statusMapping[state];
    }

    const lower = state.toLowerCase();

    if (config.finalStates.includes(state)) {
      if (lower.includes('reject')) {
        return SubmissionStatus.REJECTED;
      }
      if (lower.includes('cancel')) {
        return SubmissionStatus.CANCELLED;
      }
      return SubmissionStatus.APPROVED;
    }

    if (lower === 'cancel' || lower === 'cancelled') return SubmissionStatus.CANCELLED;
    if (lower === 'return' || lower === 'returned') return SubmissionStatus.RETURNED;

    return SubmissionStatus.UNDER_REVIEW;
  }
}
