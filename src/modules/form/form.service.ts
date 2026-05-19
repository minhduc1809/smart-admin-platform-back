import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormPageDto } from './dto/form-page.dto';
import { FilterUtil } from '../../common/utils/filter.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class FormService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFormDto) {
    return this.prisma.form.create({
      data: {
        name: dto.name,
        description: dto.description,
        schema: dto.schema as any,
        settings: (dto.settings || {}) as any,
        createdBy: userId,
      } as any,
    });
  }

  async findAll() {
    return this.prisma.form.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPage(dto: FormPageDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;

    const condition = dto.condition && typeof dto.condition === 'object' ? dto.condition : {};
    const filters = Array.isArray(dto.filters) ? dto.filters : [];

    const where = FilterUtil.buildPrismaWhere(condition, filters);
    
    // Default sorting if not provided
    const orderBy = dto.sort ? this.normalizeSort(dto.sort) : { createdAt: 'desc' };

    const { result, total } = await this.prisma.paginate(
      'form',
      {
        where,
        orderBy,
      },
      page,
      limit,
    );

    return { result, total };
  }

  async findOne(id: string) {
    const form = await this.prisma.form.findFirst({
      where: { id, deletedAt: null },
    });

    if (!form) {
      throw new NotFoundException('form.NOT_FOUND');
    }

    return form;
  }

  async update(id: string, dto: UpdateFormDto) {
    await this.findOne(id); // Check existence

    return this.prisma.form.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.schema && { schema: dto.schema as any }),
        ...(dto.settings && { settings: dto.settings as any }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check existence
    return this.prisma.softDelete('form', id);
  }

  private normalizeSort(sort: any): any {
    if (typeof sort === 'string') {
      const [field, order] = sort.split(':');
      return { [field]: order?.toLowerCase() === 'asc' ? 'asc' : 'desc' };
    }
    return sort;
  }
}
