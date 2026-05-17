import { FilterUtil, FilterDto } from './filter.util';

describe('FilterUtil', () => {
  it('should add deletedAt null by default', () => {
    const where = FilterUtil.buildPrismaWhere();
    expect(where).toEqual({ deletedAt: null });
  });

  it('should keep deletedAt when explicitly provided', () => {
    const where = FilterUtil.buildPrismaWhere({ deletedAt: { not: null } });
    expect(where).toEqual({ deletedAt: { not: null } });
  });

  it('should apply contain filter (insensitive)', () => {
    const filters: FilterDto[] = [
      { field: 'email', operator: 'contain', values: ['john'] },
    ];
    const where = FilterUtil.buildPrismaWhere({}, filters);
    expect(where.email).toEqual({ contains: 'john', mode: 'insensitive' });
  });

  it('should apply between operator', () => {
    const filters: FilterDto[] = [
      { field: 'createdAt', operator: 'between', values: ['2026-01-01', '2026-01-31'] },
    ];
    const where = FilterUtil.buildPrismaWhere({}, filters);
    expect(where.createdAt).toEqual({
      gte: '2026-01-01',
      lte: '2026-01-31',
    });
  });

  it('should apply nested field filters', () => {
    const filters: FilterDto[] = [
      { field: 'user.email', operator: 'eq', values: ['a@b.com'] },
    ];
    const where = FilterUtil.buildPrismaWhere({}, filters);
    expect(where.user.email).toEqual({ equals: 'a@b.com' });
  });

  it('should skip inactive filters', () => {
    const filters: FilterDto[] = [
      { field: 'role', operator: 'eq', values: ['ADMIN'], active: false },
    ];
    const where = FilterUtil.buildPrismaWhere({}, filters);
    expect(where.role).toBeUndefined();
    expect(where.deletedAt).toBeNull();
  });

  it('should ignore unknown operators', () => {
    const filters: FilterDto[] = [
      { field: 'role', operator: 'unknown', values: ['ADMIN'] },
    ];
    const where = FilterUtil.buildPrismaWhere({}, filters);
    expect(where.role).toBeUndefined();
    expect(where.deletedAt).toBeNull();
  });
});

