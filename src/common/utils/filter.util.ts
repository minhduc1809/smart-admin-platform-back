import * as _ from 'lodash';

export interface FilterDto {
  field: string;
  operator: string;
  values: any[];
  active?: boolean;
}

export class FilterUtil {
  static buildPrismaWhere(condition: Record<string, any> = {}, filters: FilterDto[] = []): any {
    const where: any = { ...condition };

    if (where.deletedAt === undefined) {
      where.deletedAt = null; // Default to exclude soft-deleted
    }

    if (!filters || filters.length === 0) return where;

    for (const filter of filters) {
      if (filter.active === false) continue;

      const { field, operator, values } = filter;
      const value = values[0]; // main value

      // Handle nested fields (e.g., 'user.email' -> { user: { email: xyz } })
      const buildNested = (path: string, conditionObj: any) => {
        const parts = path.split('.');
        const result = {};
        let current: any = result;
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = conditionObj;
        return result;
      };

      let opCondition: any;

      switch (operator) {
        case 'eq': opCondition = { equals: value }; break;
        case 'ne': opCondition = { not: value }; break;
        case 'contain': opCondition = { contains: value, mode: 'insensitive' }; break;
        case 'not_contain': opCondition = { not: { contains: value, mode: 'insensitive' } }; break;
        case 'in': opCondition = { in: values }; break;
        case 'not_in': opCondition = { notIn: values }; break;
        case 'lt': opCondition = { lt: value }; break;
        case 'lte': opCondition = { lte: value }; break;
        case 'gt': opCondition = { gt: value }; break;
        case 'gte': opCondition = { gte: value }; break;
        case 'between': opCondition = { gte: values[0], lte: values[1] }; break;
        case 'null': opCondition = null; break; // Prisma special null handling
        case 'not_null': opCondition = { not: null }; break;
        case 'start': opCondition = { startsWith: value, mode: 'insensitive' }; break;
        case 'end': opCondition = { endsWith: value, mode: 'insensitive' }; break;
        default: continue;
      }

      if (opCondition !== undefined) {
        // Merge into where object traversing nested paths
        _.merge(where, buildNested(field, opCondition));
      }
    }

    return where;
  }
}