import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly cls: ClsService) {
    super();

    this.$use(async (params, next) => {
      const tenantModels = [
        'User',
        'Form',
        'Submission',
        'WorkflowDefinition',
        'JobRecord',
        'FileRecord',
        'Notification',
        'Setting',
        'ApiKey',
        'AuditLog',
        'WorkflowInstance',
        'WorkflowHistory',
        'RefreshToken',
        'Delegation',
      ];

      if (params.model && tenantModels.includes(params.model)) {
        const tenantId = this.cls.get('tenantId');

        if (tenantId) {
          params.args = params.args || {};

          if (
            [
              'findMany',
              'findFirst',
              'findFirstOrThrow',
              'count',
              'updateMany',
              'deleteMany',
            ].includes(params.action)
          ) {
            params.args.where = { ...params.args.where, tenantId };
          } else if (params.action === 'create') {
            params.args.data = { ...params.args.data, tenantId };
          } else if (params.action === 'createMany') {
            if (Array.isArray(params.args.data)) {
              params.args.data = params.args.data.map((item: any) => ({
                ...item,
                tenantId,
              }));
            }
          } else if (params.action === 'upsert') {
            // Upsert where is unique, so we can't inject tenantId.
            // We just inject into create.
            params.args.create = { ...params.args.create, tenantId };
          } else if (
            ['findUnique', 'findUniqueOrThrow', 'update', 'delete'].includes(
              params.action,
            )
          ) {
            // For operations requiring unique input, we check ownership BEFORE mutation/returning
            // findFirst will automatically have tenantId injected by this very middleware!
            const existing = await (this as any)[params.model].findFirst({
              where: params.args.where,
              select: { id: true },
            });

            if (!existing) {
              if (params.action.includes('Throw')) throw new Error('Not found');
              if (params.action === 'findUnique') return null;
              throw new Error(
                `Cannot ${params.action} record: Not found or unauthorized`,
              );
            }
          }
        }
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // Graceful shutdown
  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }

  // Helper: Pagination
  async paginate(
    modelName: any,
    args: any,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;
    const [result, total] = await this.$transaction([
      (this as any)[modelName].findMany({ ...args, skip, take: limit }),
      (this as any)[modelName].count({ where: args.where }),
    ]);
    return { result, total };
  }

  // Helper: Soft Delete
  async softDelete(modelName: any, id: string) {
    return (this as any)[modelName].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Helper: FindOneOrFail
  async findOneOrFail(modelName: any, args: any, errorMessage: string) {
    const record = await (this as any)[modelName].findFirst(args);
    if (!record) {
      throw new Error(errorMessage);
    }
    return record;
  }
}
