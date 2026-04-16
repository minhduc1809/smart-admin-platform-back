import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
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
  async paginate(modelName: any, args: any, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [result, total] = await this.$transaction([
      (this as any)[modelName].findMany({ ...args, skip, take: limit }),
      (this as any)[modelName].count({ where: args.where })
    ]);
    return { result, total };
  }

  // Helper: Soft Delete
  async softDelete(modelName: any, id: string) {
    return (this as any)[modelName].update({
      where: { id },
      data: { deletedAt: new Date() }
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