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
    startState?: string,
  ) {
    const config = workflowDefinition.config as WorkflowConfig;
    const initialState = startState || config.initialState;

    const instance = await tx.workflowInstance.create({
      data: {
        tenantId: context.tenantId,
        definitionId: workflowDefinition.id,
        submissionId,
        currentStep: initialState,
        status: 'ACTIVE',
      },
    });

    await tx.workflowHistory.create({
      data: {
        tenantId: context.tenantId,
        instanceId: instance.id,
        fromStep: null,
        toStep: initialState,
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
    delegatedForId?: string,
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

    let effectiveRole = actorRole;
    if (delegatedForId) {
      const delegator = await tx.user.findUnique({
        where: { id: delegatedForId },
        select: { role: true },
      });
      if (!delegator) {
        throw new NotFoundException('workflow.DELEGATOR_NOT_FOUND');
      }
      effectiveRole = delegator.role;
    }

    const config = instance.definition.config as unknown as WorkflowConfig;
    const currentState = instance.currentStep;

    const transition = this.findTransition(config, currentState, action);
    if (!transition) {
      throw new BadRequestException('workflow.INVALID_TRANSITION');
    }

    this.validatePermission(transition, effectiveRole);

    if (transition.conditions?.requireComment && !comment) {
      throw new BadRequestException('workflow.COMMENT_REQUIRED');
    }

    const isParallel = transition.type === 'PARALLEL_JOIN';
    const isVoting = transition.type === 'VOTING';
    let isTransitioning = true;
    let newState = transition.to;

    if (isParallel && transition.requireActions) {
      const existingVote = await tx.workflowHistory.findFirst({
        where: {
          instanceId,
          fromStep: currentState,
          toStep: currentState,
          action,
        },
      });
      if (existingVote) {
        throw new BadRequestException('workflow.ACTION_ALREADY_PERFORMED');
      }

      const pastVotes = await tx.workflowHistory.findMany({
        where: {
          instanceId,
          fromStep: currentState,
          toStep: currentState,
        },
        select: { action: true },
      });

      const completedActions = new Set(pastVotes.map((v) => v.action));
      completedActions.add(action);

      const allSatisfied = transition.requireActions.every((req) =>
        completedActions.has(req),
      );

      if (!allSatisfied) {
        isTransitioning = false;
        newState = currentState;
      }
    } else if (isVoting && transition.votingConfig) {
      const vc = transition.votingConfig;

      // Check duplicate vote by same actor
      const existingVote = await tx.workflowHistory.findFirst({
        where: {
          instanceId,
          fromStep: currentState,
          toStep: currentState,
          actorId,
          action: { in: [vc.approveAction, vc.rejectAction] },
        },
      });
      if (existingVote) {
        throw new BadRequestException('workflow.ALREADY_VOTED');
      }

      // Count existing votes
      const pastVotes = await tx.workflowHistory.findMany({
        where: {
          instanceId,
          fromStep: currentState,
          toStep: currentState,
          action: { in: [vc.approveAction, vc.rejectAction] },
        },
        select: { action: true },
      });

      const approveCount =
        pastVotes.filter((v) => v.action === vc.approveAction).length +
        (action === vc.approveAction ? 1 : 0);
      const rejectCount =
        pastVotes.filter((v) => v.action === vc.rejectAction).length +
        (action === vc.rejectAction ? 1 : 0);

      if (approveCount >= vc.approveThreshold) {
        newState = vc.approveTarget;
        isTransitioning = true;
      } else if (vc.rejectThreshold && rejectCount >= vc.rejectThreshold) {
        newState = vc.rejectTarget;
        isTransitioning = true;
      } else {
        isTransitioning = false;
        newState = currentState;
      }
    }

    const isNowCompleted = isTransitioning
      ? this.isCompleted(config, newState)
      : false;

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
        delegatedForId: delegatedForId || null,
      },
    });

    if (isParallel && isTransitioning) {
      await tx.workflowHistory.create({
        data: {
          tenantId: instance.tenantId,
          instanceId,
          fromStep: currentState,
          toStep: newState,
          action: 'PARALLEL_JOIN_COMPLETE',
          actorId: 'SYSTEM',
          comment: `Parallel approval complete: ${transition.requireActions?.join(', ')}`,
        },
      });
    }

    if (isVoting && isTransitioning && transition.votingConfig) {
      await tx.workflowHistory.create({
        data: {
          tenantId: instance.tenantId,
          instanceId,
          fromStep: currentState,
          toStep: newState,
          action: 'VOTING_COMPLETE',
          actorId: 'SYSTEM',
          comment: `Voting concluded. Threshold: ${transition.votingConfig.approveThreshold} approvals needed.`,
        },
      });
    }

    if (isTransitioning) {
      const submissionStatus = this.mapToSubmissionStatus(
        config,
        newState,
        transition,
      );
      await tx.submission.update({
        where: { id: instance.submissionId },
        data: { status: submissionStatus },
      });
    }

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
        if (!fromMatch) return false;

        if (t.type === 'PARALLEL_JOIN' && t.requireActions) {
          return t.requireActions.includes(action);
        }

        if (t.type === 'VOTING' && t.votingConfig) {
          return (
            action === t.votingConfig.approveAction ||
            action === t.votingConfig.rejectAction
          );
        }

        return t.action === action;
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

    if (lower === 'cancel' || lower === 'cancelled')
      return SubmissionStatus.CANCELLED;
    if (lower === 'return' || lower === 'returned')
      return SubmissionStatus.RETURNED;

    return SubmissionStatus.UNDER_REVIEW;
  }
}
