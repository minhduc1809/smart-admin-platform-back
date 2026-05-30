import { ForbiddenException } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';
import { WorkflowConfig } from './interfaces/workflow-config.interface';

describe('WorkflowEngine', () => {
  const engine = new WorkflowEngine();

  it('findTransition matches action and state', () => {
    const config: WorkflowConfig = {
      states: ['draft', 'submitted'],
      initialState: 'draft',
      finalStates: ['submitted'],
      transitions: [{ from: 'draft', to: 'submitted', action: 'submit' }],
    };

    const transition = engine.findTransition(config, 'draft', 'submit');
    expect(transition?.to).toBe('submitted');
  });

  it('validatePermission throws when role not allowed', () => {
    expect(() =>
      engine.validatePermission(
        { from: 'draft', to: 'submitted', action: 'submit', roles: ['ADMIN'] },
        'USER',
      ),
    ).toThrow(ForbiddenException);
  });

  it('validatePermission throws when roles is empty', () => {
    expect(() =>
      engine.validatePermission(
        { from: 'draft', to: 'submitted', action: 'submit', roles: [] },
        'ADMIN',
      ),
    ).toThrow(ForbiddenException);
  });

  it('validatePermission throws when roles is undefined', () => {
    expect(() =>
      engine.validatePermission(
        { from: 'draft', to: 'submitted', action: 'submit' } as any,
        'ADMIN',
      ),
    ).toThrow(ForbiddenException);
  });

  it('validatePermission passes when role is in list', () => {
    expect(() =>
      engine.validatePermission(
        {
          from: 'draft',
          to: 'submitted',
          action: 'submit',
          roles: ['ADMIN', 'MANAGER'],
        },
        'ADMIN',
      ),
    ).not.toThrow();
  });

  it('isCompleted returns true for final states', () => {
    const config: WorkflowConfig = {
      states: ['draft', 'approved'],
      initialState: 'draft',
      finalStates: ['approved'],
      transitions: [{ from: 'draft', to: 'approved', action: 'approve' }],
    };

    expect(engine.isCompleted(config, 'approved')).toBe(true);
  });

  describe('PARALLEL_JOIN transitions', () => {
    const config: WorkflowConfig = {
      states: ['PENDING_APPROVAL', 'APPROVED'],
      initialState: 'PENDING_APPROVAL',
      finalStates: ['APPROVED'],
      transitions: [
        {
          from: 'PENDING_APPROVAL',
          to: 'APPROVED',
          action: '',
          type: 'PARALLEL_JOIN',
          requireActions: ['TECH_APPROVE', 'FINANCE_APPROVE'],
          roles: ['MANAGER'],
        },
      ],
    };

    it('does not transition if only one action is executed', async () => {
      const tx = {
        workflowInstance: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inst-1',
            status: 'ACTIVE',
            currentStep: 'PENDING_APPROVAL',
            tenantId: 'tenant-1',
            submissionId: 'sub-1',
            definition: { config },
          }),
          update: jest.fn(),
        },
        workflowHistory: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(),
        },
        submission: {
          update: jest.fn(),
        },
      } as any;

      const result = await engine.executeAction(
        tx,
        'inst-1',
        'TECH_APPROVE',
        'user-1',
        'MANAGER',
      );

      expect(result.currentState).toBe('PENDING_APPROVAL');
      expect(result.isCompleted).toBe(false);
      expect(tx.workflowInstance.update).toHaveBeenCalledWith({
        where: { id: 'inst-1' },
        data: { currentStep: 'PENDING_APPROVAL', status: 'ACTIVE' },
      });
      expect(tx.workflowHistory.create).toHaveBeenCalledTimes(1);
    });

    it('transitions when all actions are executed', async () => {
      const tx = {
        workflowInstance: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inst-1',
            status: 'ACTIVE',
            currentStep: 'PENDING_APPROVAL',
            tenantId: 'tenant-1',
            submissionId: 'sub-1',
            definition: { config },
          }),
          update: jest.fn(),
        },
        workflowHistory: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([{ action: 'TECH_APPROVE' }]),
          create: jest.fn(),
        },
        submission: {
          update: jest.fn(),
        },
      } as any;

      const result = await engine.executeAction(
        tx,
        'inst-1',
        'FINANCE_APPROVE',
        'user-1',
        'MANAGER',
      );

      expect(result.currentState).toBe('APPROVED');
      expect(result.isCompleted).toBe(true);
      expect(tx.workflowInstance.update).toHaveBeenCalledWith({
        where: { id: 'inst-1' },
        data: { currentStep: 'APPROVED', status: 'COMPLETED' },
      });
      expect(tx.workflowHistory.create).toHaveBeenCalledTimes(2);
      expect(tx.submission.update).toHaveBeenCalled();
    });

    it('throws if the same vote action is executed twice', async () => {
      const tx = {
        workflowInstance: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inst-1',
            status: 'ACTIVE',
            currentStep: 'PENDING_APPROVAL',
            tenantId: 'tenant-1',
            submissionId: 'sub-1',
            definition: { config },
          }),
        },
        workflowHistory: {
          findFirst: jest.fn().mockResolvedValue({ id: 'hist-1' }),
        },
      } as any;

      await expect(
        engine.executeAction(tx, 'inst-1', 'TECH_APPROVE', 'user-1', 'MANAGER'),
      ).rejects.toThrow();
    });
  });

  describe('Delegation support', () => {
    const config: WorkflowConfig = {
      states: ['DRAFT', 'APPROVED'],
      initialState: 'DRAFT',
      finalStates: ['APPROVED'],
      transitions: [
        {
          from: 'DRAFT',
          to: 'APPROVED',
          action: 'approve',
          roles: ['MANAGER'],
        },
      ],
    };

    it('allows action if delegated user acts for manager', async () => {
      const tx = {
        workflowInstance: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inst-1',
            status: 'ACTIVE',
            currentStep: 'DRAFT',
            tenantId: 'tenant-1',
            submissionId: 'sub-1',
            definition: { config },
          }),
          update: jest.fn(),
        },
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'boss-1', role: 'MANAGER' }),
        },
        workflowHistory: {
          create: jest.fn(),
        },
        submission: {
          update: jest.fn(),
        },
      } as any;

      const result = await engine.executeAction(
        tx,
        'inst-1',
        'approve',
        'user-1',
        'USER',
        'Delegated approval',
        'boss-1',
      );

      expect(result.currentState).toBe('APPROVED');
      expect(tx.workflowHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            delegatedForId: 'boss-1',
          }),
        }),
      );
    });
  });
});
