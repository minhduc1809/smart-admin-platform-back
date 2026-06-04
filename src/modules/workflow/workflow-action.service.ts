import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from './workflow.engine';
import { ExecuteActionDto } from './dto/execute-action.dto';
import { WorkflowConfig } from './interfaces/workflow-config.interface';
import { SubmissionService } from '../submission/submission.service';

@Injectable()
export class WorkflowActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => SubmissionService))
    private readonly submissionService: SubmissionService,
  ) {}

  async execute(actorId: string, actorRole: string, dto: ExecuteActionDto) {
    if (dto.action === 'resubmit') {
      return this.handleResubmit(actorId, actorRole, dto);
    }

    if (dto.delegatedForId) {
      const now = new Date();
      const activeDelegation = await this.prisma.delegation.findFirst({
        where: {
          fromUserId: dto.delegatedForId,
          toUserId: actorId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });
      if (!activeDelegation) {
        throw new ForbiddenException('workflow.INVALID_DELEGATION');
      }

      // Check delegation scope: form restriction
      if (activeDelegation.formIds.length > 0) {
        const submission = await this.prisma.submission.findUnique({
          where: { id: dto.submissionId },
          select: { formId: true },
        });
        if (
          !submission ||
          !activeDelegation.formIds.includes(submission.formId)
        ) {
          throw new ForbiddenException('workflow.DELEGATION_SCOPE_FORM');
        }
      }

      // Check delegation scope: workflow definition restriction
      if (activeDelegation.workflowDefinitionIds.length > 0) {
        const instance = await this.prisma.workflowInstance.findFirst({
          where: { submissionId: dto.submissionId, status: 'ACTIVE' },
          select: { definitionId: true },
        });
        if (
          !instance ||
          !activeDelegation.workflowDefinitionIds.includes(
            instance.definitionId,
          )
        ) {
          throw new ForbiddenException('workflow.DELEGATION_SCOPE_WORKFLOW');
        }
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findFirst({
        where: {
          submissionId: dto.submissionId,
          status: 'ACTIVE',
        },
      });

      if (!instance) {
        throw new NotFoundException('workflow.INSTANCE_NOT_FOUND');
      }

      return await this.workflowEngine.executeAction(
        tx,
        instance.id,
        dto.action,
        actorId,
        actorRole,
        dto.comment,
        dto.delegatedForId,
      );
    });

    await this.eventEmitter.emitAsync('workflow.state.changed', {
      submissionId: result.submissionId,
      instanceId: result.instanceId,
      fromState: result.previousState,
      toState: result.currentState,
      action: dto.action,
      actorId,
      delegatedForId: dto.delegatedForId,
    });

    if (result.isCompleted) {
      await this.eventEmitter.emitAsync('workflow.completed', {
        submissionId: result.submissionId,
        instanceId: result.instanceId,
        finalState: result.currentState,
      });
    }

    return result;
  }

  private async handleResubmit(
    actorId: string,
    actorRole: string,
    dto: ExecuteActionDto,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: dto.submissionId },
      include: {
        workflows: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { definition: true },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('submission.NOT_FOUND');
    }

    const latestInstance = submission.workflows[0];
    if (!latestInstance) {
      throw new BadRequestException('workflow.INSTANCE_NOT_FOUND');
    }

    const config = latestInstance.definition
      .config as unknown as WorkflowConfig;
    const currentState = latestInstance.currentStep;

    const transition = this.workflowEngine.findTransition(
      config,
      currentState,
      'resubmit',
    );
    if (!transition) {
      throw new BadRequestException('workflow.INVALID_TRANSITION');
    }
    this.workflowEngine.validatePermission(transition, actorRole);

    const newSubmission = await this.submissionService.resubmit(
      actorId,
      dto.submissionId,
      dto.data,
    );

    // Record resubmit in the old instance's history
    await this.prisma.workflowHistory.create({
      data: {
        tenantId: latestInstance.tenantId,
        instanceId: latestInstance.id,
        fromStep: currentState,
        toStep: 'resubmitted',
        action: 'resubmit',
        actorId,
        comment: dto.comment,
      },
    });

    this.eventEmitter.emit('workflow.resubmitted', {
      originalSubmissionId: dto.submissionId,
      newSubmissionId: newSubmission.id,
      actorId,
    });

    return {
      originalSubmissionId: dto.submissionId,
      newSubmissionId: newSubmission.id,
      action: 'resubmit',
      revisionNumber: newSubmission.revisionNumber,
    };
  }

  async getHistory(submissionId: string, includeRevisions = false) {
    if (includeRevisions) {
      return this.getRevisionChainHistory(submissionId);
    }

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

    const actorIds = [...new Set(instance.histories.map((h) => h.actorId))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    return {
      instanceId: instance.id,
      currentStep: instance.currentStep,
      status: instance.status,
      workflowName: instance.definition.name,
      history: instance.histories.map((h) => {
        const actor = actorMap.get(h.actorId);
        return {
          ...h,
          actor: actor
            ? {
                id: actor.id,
                email: actor.email,
                name:
                  actor.username ||
                  `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() ||
                  actor.email,
              }
            : null,
        };
      }),
    };
  }

  private async getRevisionChainHistory(submissionId: string) {
    // Walk up to root (with cycle detection)
    let current = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, parentSubmissionId: true },
    });

    const visited = new Set<string>();
    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      if (!current.parentSubmissionId) break;
      const parent = await this.prisma.submission.findUnique({
        where: { id: current.parentSubmissionId },
        select: { id: true, parentSubmissionId: true },
      });
      if (!parent) break;
      current = parent;
    }

    const rootId = current?.id ?? submissionId;

    // Collect all descendant IDs in batches
    const chain: string[] = [rootId];
    let frontier = [rootId];
    while (frontier.length > 0) {
      const children = await this.prisma.submission.findMany({
        where: { parentSubmissionId: { in: frontier } },
        select: { id: true },
        orderBy: { revisionNumber: 'asc' },
      });
      frontier = children.map((c) => c.id);
      chain.push(...frontier);
    }

    const instances = await this.prisma.workflowInstance.findMany({
      where: { submissionId: { in: chain } },
      include: {
        histories: { orderBy: { createdAt: 'asc' } },
        definition: { select: { name: true } },
        submission: { select: { revisionNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const allActorIds = [
      ...new Set(
        instances.flatMap((inst) => inst.histories.map((h) => h.actorId)),
      ),
    ];
    const allActors = await this.prisma.user.findMany({
      where: { id: { in: allActorIds } },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });
    const actorMap = new Map(allActors.map((a) => [a.id, a]));

    return {
      revisionChain: chain,
      revisions: instances.map((inst) => ({
        submissionId: inst.submissionId,
        revisionNumber: inst.submission.revisionNumber,
        instanceId: inst.id,
        currentStep: inst.currentStep,
        status: inst.status,
        workflowName: inst.definition.name,
        history: inst.histories.map((h) => {
          const actor = actorMap.get(h.actorId);
          return {
            ...h,
            actor: actor
              ? {
                  id: actor.id,
                  email: actor.email,
                  name:
                    actor.username ||
                    `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() ||
                    actor.email,
                }
              : null,
          };
        }),
      })),
    };
  }

  async getAvailableActions(
    submissionId: string,
    userRole: string,
    userId?: string,
  ) {
    let instance = await this.prisma.workflowInstance.findFirst({
      where: {
        submissionId,
        status: 'ACTIVE',
      },
      include: { definition: true },
    });

    // If no active instance, check completed/cancelled for resubmit-type actions
    if (!instance) {
      instance = await this.prisma.workflowInstance.findFirst({
        where: {
          submissionId,
          status: { in: ['COMPLETED', 'CANCELLED'] },
        },
        orderBy: { updatedAt: 'desc' },
        include: { definition: true },
      });
    }

    if (!instance) {
      return { actions: [] };
    }

    const config = instance.definition.config as unknown as WorkflowConfig;
    const currentState = instance.currentStep;

    const roles = new Set<string>([userRole]);
    if (userId) {
      const now = new Date();
      const activeDelegations = await this.prisma.delegation.findMany({
        where: {
          toUserId: userId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: { fromUser: true },
      });

      const submission = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        select: { formId: true },
      });

      for (const del of activeDelegations) {
        // Skip delegation if scoped to specific forms and this form is not included
        if (
          del.formIds.length > 0 &&
          submission &&
          !del.formIds.includes(submission.formId)
        ) {
          continue;
        }
        // Skip delegation if scoped to specific workflows and this definition is not included
        if (
          del.workflowDefinitionIds.length > 0 &&
          instance &&
          !del.workflowDefinitionIds.includes(instance.definitionId)
        ) {
          continue;
        }
        roles.add(del.fromUser.role);
      }
    }

    const performedVotes = await this.prisma.workflowHistory.findMany({
      where: {
        instanceId: instance.id,
        fromStep: currentState,
        toStep: currentState,
      },
      select: { action: true, actorId: true },
    });
    const performedActions = new Set(performedVotes.map((v) => v.action));

    const availableActions: Array<{
      action: string;
      targetState: string;
      requiresComment: boolean;
      isParallel: boolean;
    }> = [];
    for (const t of config.transitions) {
      const fromMatch = Array.isArray(t.from)
        ? t.from.includes(currentState)
        : t.from === currentState || t.from === '*';
      const roleMatch =
        t.roles && t.roles.length > 0 && t.roles.some((r) => roles.has(r));

      if (fromMatch && roleMatch) {
        if (t.type === 'PARALLEL_JOIN' && t.requireActions) {
          for (const act of t.requireActions) {
            if (!performedActions.has(act)) {
              availableActions.push({
                action: act,
                targetState: t.to,
                requiresComment: t.conditions?.requireComment || false,
                isParallel: true,
              });
            }
          }
        } else if (t.type === 'VOTING' && t.votingConfig) {
          const vc = t.votingConfig;
          const userAlreadyVoted = userId
            ? performedVotes.some(
                (v) =>
                  v.actorId === userId &&
                  (v.action === vc.approveAction ||
                    v.action === vc.rejectAction),
              )
            : false;
          if (!userAlreadyVoted) {
            availableActions.push({
              action: vc.approveAction,
              targetState: vc.approveTarget,
              requiresComment: t.conditions?.requireComment || false,
              isParallel: false,
            });
            availableActions.push({
              action: vc.rejectAction,
              targetState: vc.rejectTarget,
              requiresComment: t.conditions?.requireComment || false,
              isParallel: false,
            });
          }
        } else {
          availableActions.push({
            action: t.action,
            targetState: t.to,
            requiresComment: t.conditions?.requireComment || false,
            isParallel: false,
          });
        }
      }
    }

    return {
      currentState,
      actions: availableActions,
    };
  }

  async getPendingForUser(
    userRole: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const roles = new Set<string>([userRole]);
    const now = new Date();
    const activeDelegations = await this.prisma.delegation.findMany({
      where: {
        toUserId: userId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: { fromUser: true },
    });

    // Collect roles from unscoped delegations (scoped ones are checked per-instance below)
    const unscopedDelegations = activeDelegations.filter(
      (d) => d.formIds.length === 0 && d.workflowDefinitionIds.length === 0,
    );
    for (const del of unscopedDelegations) {
      roles.add(del.fromUser.role);
    }
    const scopedDelegations = activeDelegations.filter(
      (d) => d.formIds.length > 0 || d.workflowDefinitionIds.length > 0,
    );

    // Pass 1: fetch all active instance IDs with their config (lightweight)
    const allActive = await this.prisma.workflowInstance.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        currentStep: true,
        definitionId: true,
        submissionId: true,
        definition: { select: { config: true } },
        submission: { select: { formId: true } },
      },
    });

    // Filter by role in memory to get the matching IDs
    const matchingIds = allActive
      .filter((inst) => {
        const config = inst.definition.config as unknown as WorkflowConfig;

        // Build effective roles for this specific instance (base roles + scoped delegation roles)
        const effectiveRoles = new Set(roles);
        for (const del of scopedDelegations) {
          const formOk =
            del.formIds.length === 0 ||
            del.formIds.includes(inst.submission.formId);
          const wfOk =
            del.workflowDefinitionIds.length === 0 ||
            del.workflowDefinitionIds.includes(inst.definitionId);
          if (formOk && wfOk) {
            effectiveRoles.add(del.fromUser.role);
          }
        }

        return config.transitions.some((t) => {
          const fromMatch = Array.isArray(t.from)
            ? t.from.includes(inst.currentStep)
            : t.from === inst.currentStep || t.from === '*';
          const roleMatch =
            !t.roles ||
            t.roles.length === 0 ||
            t.roles.some((r) => effectiveRoles.has(r));
          return fromMatch && roleMatch;
        });
      })
      .map((inst) => inst.id);

    const total = matchingIds.length;
    const paginatedIds = matchingIds.slice(skip, skip + limit);

    // Pass 2: fetch paginated IDs with full includes
    const instances = await this.prisma.workflowInstance.findMany({
      where: { id: { in: paginatedIds } },
      include: {
        submission: {
          include: {
            form: { select: { name: true, schema: true } },
            user: { select: { email: true, username: true } },
          },
        },
        definition: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: instances.map((inst) => ({
        id: inst.id,
        submissionId: inst.submissionId,
        currentStep: inst.currentStep,
        status: inst.status,
        createdAt: inst.createdAt,
        updatedAt: inst.updatedAt,
        definitionId: inst.definitionId,
        submission: {
          id: inst.submission.id,
          data: inst.submission.data,
          status: inst.submission.status,
          submittedBy: inst.submission.submittedBy,
          createdAt: inst.submission.createdAt,
          form: inst.submission.form,
          user: inst.submission.user,
        },
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
