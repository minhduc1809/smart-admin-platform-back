import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role, Prisma } from '@prisma/client';
import { FilterUtil } from '../../common/utils/filter.util';
import { UserPageDto } from './dto/user-page.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const username = dto.username.toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      throw new ConflictException('user.USERNAME_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        username,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role || Role.USER,
        passwordChangeRequired: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        passwordChangeRequired: true,
        createdAt: true,
      },
    });

    return user;
  }

  async findOne(id: string) {
    return this.getProfile(id); // Re-use getProfile since it selects the safe fields
  }

  async findMany(params: {
    page?: number;
    limit?: number;
    role?: Role;
    status?: string;
    search?: string;
    sort?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, params.limit ?? 10);
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (params.role) {
      where.role = params.role;
    }

    if (params.status) {
      const statusValue = params.status.toLowerCase();
      if (['active', 'true', '1'].includes(statusValue)) {
        where.isActive = true;
      } else if (['inactive', 'false', '0'].includes(statusValue)) {
        where.isActive = false;
      }
    }

    if (params.search) {
      const term = params.search.trim().toLowerCase();
      if (term) {
        where.OR = [
          { email: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const orderBy = this.buildOrderBy(params.sort);

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findPage(dto: UserPageDto) {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.max(1, dto.limit ?? 10);

    const condition =
      dto.condition && typeof dto.condition === 'object' ? dto.condition : {};
    const filters = Array.isArray(dto.filters) ? dto.filters : [];

    const where = FilterUtil.buildPrismaWhere(condition, filters);
    const orderBy = this.buildOrderByFromSortInput(dto.sort);

    const { result, total } = await this.prisma.paginate(
      'user',
      {
        where,
        orderBy,
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
        },
      },
      page,
      limit,
    );

    return { result, total };
  }

  private buildOrderBy(sort?: string): Prisma.UserOrderByWithRelationInput {
    if (!sort) {
      return { createdAt: 'desc' };
    }

    const [fieldRaw, directionRaw] = sort.split(':');
    const field = fieldRaw?.trim();
    const direction = directionRaw?.trim().toLowerCase();

    const allowedFields = new Set([
      'createdAt',
      'email',
      'username',
      'firstName',
      'lastName',
      'role',
      'isActive',
    ]);

    if (!field || !allowedFields.has(field)) {
      return { createdAt: 'desc' };
    }

    if (direction !== 'asc' && direction !== 'desc') {
      return { createdAt: 'desc' };
    }

    return { [field]: direction } as Prisma.UserOrderByWithRelationInput;
  }

  private buildOrderByFromSortInput(
    sort?:
      | string
      | { field?: string; order?: string }
      | Array<{ field?: string; order?: string }>,
  ):
    | Prisma.UserOrderByWithRelationInput
    | Prisma.UserOrderByWithRelationInput[] {
    if (!sort) {
      return { createdAt: 'desc' };
    }

    if (typeof sort === 'string') {
      return this.buildOrderBy(sort);
    }

    if (Array.isArray(sort)) {
      const orders = sort
        .map((item) => this.normalizeSortItem(item))
        .filter(Boolean) as Prisma.UserOrderByWithRelationInput[];
      return orders.length > 0 ? orders : { createdAt: 'desc' };
    }

    const order = this.normalizeSortItem(sort);
    return order ?? { createdAt: 'desc' };
  }

  private normalizeSortItem(item?: {
    field?: string;
    order?: string;
  }): Prisma.UserOrderByWithRelationInput | null {
    const field = item?.field?.trim();
    const direction = item?.order?.trim().toLowerCase();

    const allowedFields = new Set([
      'createdAt',
      'email',
      'username',
      'firstName',
      'lastName',
      'role',
      'isActive',
    ]);

    if (!field || !allowedFields.has(field)) {
      return null;
    }

    if (direction !== 'asc' && direction !== 'desc') {
      return null;
    }

    return { [field]: direction } as Prisma.UserOrderByWithRelationInput;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        picture: true,
        isActive: true,
        passwordChangeRequired: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('user.NOT_FOUND');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.getProfile(id);

    const data: any = { ...dto };
    if (dto.email) data.email = dto.email.toLowerCase();

    if (data.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
          deletedAt: null,
          email: data.email,
        },
      });
      if (existing) throw new ConflictException('user.ALREADY_EXISTS');
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.getProfile(userId);

    const data: any = { ...dto };

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        picture: true,
        isActive: true,
        passwordChangeRequired: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    await this.getProfile(id); // Check existence
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async assignRole(id: string, role: Role) {
    await this.getProfile(id); // Check existence
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}
