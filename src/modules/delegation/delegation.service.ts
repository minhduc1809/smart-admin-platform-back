import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { UpdateDelegationDto } from './dto/update-delegation.dto';
import { Role } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class DelegationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(userId: string, userRole: string, dto: CreateDelegationDto) {
    // Permission check: regular user can only delegate their own work
    if (
      userRole !== Role.ADMIN &&
      userRole !== Role.MANAGER &&
      dto.fromUserId !== userId
    ) {
      throw new ForbiddenException('delegation.NOT_ALLOWED');
    }

    // Validate users exist
    const fromUser = await this.prisma.user.findUnique({
      where: { id: dto.fromUserId },
    });
    const toUser = await this.prisma.user.findUnique({
      where: { id: dto.toUserId },
    });

    if (!fromUser || !toUser) {
      throw new NotFoundException('delegation.USER_NOT_FOUND');
    }

    if (fromUser.tenantId !== toUser.tenantId) {
      throw new BadRequestException('delegation.TENANT_MISMATCH');
    }

    // Validate scope IDs exist in the tenant
    if (dto.formIds && dto.formIds.length > 0) {
      const forms = await this.prisma.form.findMany({
        where: { id: { in: dto.formIds }, tenantId: fromUser.tenantId },
        select: { id: true },
      });
      if (forms.length !== dto.formIds.length) {
        throw new BadRequestException('delegation.INVALID_FORM_IDS');
      }
    }

    if (dto.workflowDefinitionIds && dto.workflowDefinitionIds.length > 0) {
      const defs = await this.prisma.workflowDefinition.findMany({
        where: {
          id: { in: dto.workflowDefinitionIds },
          tenantId: fromUser.tenantId,
        },
        select: { id: true },
      });
      if (defs.length !== dto.workflowDefinitionIds.length) {
        throw new BadRequestException(
          'delegation.INVALID_WORKFLOW_DEFINITION_IDS',
        );
      }
    }

    const delegation = await this.prisma.delegation.create({
      data: {
        tenantId: fromUser.tenantId,
        fromUserId: dto.fromUserId,
        toUserId: dto.toUserId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        formIds: dto.formIds ?? [],
        workflowDefinitionIds: dto.workflowDefinitionIds ?? [],
      },
    });

    // Thông báo cho người được ủy quyền — lỗi thông báo không chặn việc tạo
    this.notificationService
      .notifyDelegationCreated({
        delegationId: delegation.id,
        fromUserId: delegation.fromUserId,
        toUserId: delegation.toUserId,
        startDate: delegation.startDate,
        endDate: delegation.endDate,
        formCount: delegation.formIds.length,
        workflowCount: delegation.workflowDefinitionIds.length,
      })
      .catch(() => undefined);

    return delegation;
  }

  async findAll(
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    // Filter: admins/managers see all; users see delegations they're involved in
    const where: any = {};
    if (userRole !== Role.ADMIN && userRole !== Role.MANAGER) {
      where.OR = [{ fromUserId: userId }, { toUserId: userId }];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.delegation.findMany({
        where,
        include: {
          fromUser: {
            select: { id: true, email: true, username: true, role: true },
          },
          toUser: {
            select: { id: true, email: true, username: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.delegation.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const delegation = await this.prisma.delegation.findUnique({
      where: { id },
      include: {
        fromUser: {
          select: { id: true, email: true, username: true, role: true },
        },
        toUser: {
          select: { id: true, email: true, username: true, role: true },
        },
      },
    });

    if (!delegation) {
      throw new NotFoundException('delegation.NOT_FOUND');
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== Role.MANAGER &&
      delegation.fromUserId !== userId &&
      delegation.toUserId !== userId
    ) {
      throw new ForbiddenException('error.FORBIDDEN');
    }

    return delegation;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    dto: UpdateDelegationDto,
  ) {
    const delegation = await this.prisma.delegation.findUnique({
      where: { id },
    });

    if (!delegation) {
      throw new NotFoundException('delegation.NOT_FOUND');
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== Role.MANAGER &&
      delegation.fromUserId !== userId
    ) {
      throw new ForbiddenException('delegation.NOT_ALLOWED');
    }

    const updateData: any = {};
    if (dto.fromUserId) updateData.fromUserId = dto.fromUserId;
    if (dto.toUserId) updateData.toUserId = dto.toUserId;
    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.formIds !== undefined) updateData.formIds = dto.formIds;
    if (dto.workflowDefinitionIds !== undefined)
      updateData.workflowDefinitionIds = dto.workflowDefinitionIds;

    return this.prisma.delegation.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    const delegation = await this.prisma.delegation.findUnique({
      where: { id },
    });

    if (!delegation) {
      throw new NotFoundException('delegation.NOT_FOUND');
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== Role.MANAGER &&
      delegation.fromUserId !== userId
    ) {
      throw new ForbiddenException('delegation.NOT_ALLOWED');
    }

    return this.prisma.delegation.delete({
      where: { id },
    });
  }
}
