import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationEngine } from '../form/validation.engine';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { SubmissionService } from './submission.service';

describe('SubmissionService', () => {
  let prisma: any;
  let validationEngine: any;
  let workflowEngine: any;
  let service: SubmissionService;

  beforeEach(() => {
    prisma = {
      form: { findUnique: jest.fn() },
      workflowDefinition: { findFirst: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
      },
      submission: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    validationEngine = {
      validate: jest.fn(),
    } as unknown as ValidationEngine;

    workflowEngine = {
      initiate: jest.fn(),
    } as unknown as WorkflowEngine;

    service = new SubmissionService(prisma, validationEngine, workflowEngine);
  });

  it('create throws when form not found', async () => {
    prisma.form.findUnique.mockResolvedValue(null);

    await expect(
      service.create('user-1', { formId: 'form-1', data: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create throws when validation fails', async () => {
    prisma.form.findUnique.mockResolvedValue({ id: 'form-1', schema: {} });
    validationEngine.validate.mockReturnValue([
      { field: 'name', i18nKey: 'validation.required' },
    ]);

    await expect(
      service.create('user-1', { formId: 'form-1', data: {} }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('create returns submission when no workflow is defined', async () => {
    prisma.form.findUnique.mockResolvedValue({ id: 'form-1', schema: {} });
    validationEngine.validate.mockReturnValue([]);
    prisma.workflowDefinition.findFirst.mockResolvedValue(null);

    const tx = {
      submission: {
        create: jest.fn().mockResolvedValue({ id: 'sub-1' }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.create('user-1', {
      formId: 'form-1',
      data: { field: 'value' },
    });

    expect(result.id).toBe('sub-1');
    expect(workflowEngine.initiate).not.toHaveBeenCalled();
  });

  describe('recall and withdraw', () => {
    it('recall throws when not in initial step', async () => {
      const activeWorkflow = {
        id: 'wf-1',
        status: 'ACTIVE',
        definitionId: 'def-1',
        currentStep: 'STATE_B',
        tenantId: 'tenant-1',
      };
      prisma.submission.findUnique = jest.fn().mockResolvedValue({
        id: 'sub-1',
        submittedBy: 'user-1',
        workflows: [activeWorkflow],
      });
      prisma.workflowDefinition.findUnique = jest.fn().mockResolvedValue({
        id: 'def-1',
        config: { initialState: 'STATE_A' },
      });

      await expect(service.recall('sub-1', 'user-1')).rejects.toThrow();
    });

    it('withdraw cancels the active workflow and sets status to CANCELLED', async () => {
      const activeWorkflow = {
        id: 'wf-1',
        status: 'ACTIVE',
        definitionId: 'def-1',
        currentStep: 'STATE_B',
        tenantId: 'tenant-1',
      };
      prisma.submission.findUnique = jest.fn().mockResolvedValue({
        id: 'sub-1',
        submittedBy: 'user-1',
        status: 'UNDER_REVIEW',
        workflows: [activeWorkflow],
      });

      const tx = {
        workflowInstance: { update: jest.fn() },
        workflowHistory: { create: jest.fn() },
        submission: {
          update: jest
            .fn()
            .mockResolvedValue({ id: 'sub-1', status: 'CANCELLED' }),
        },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

      const result = await service.withdraw('sub-1', 'user-1');

      expect(tx.workflowInstance.update).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        data: { status: 'CANCELLED' },
      });
      expect(tx.submission.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: 'CANCELLED' },
      });
    });
  });

  describe('resubmit restrictions and fast-track', () => {
    it('resubmit throws if status is not RETURNED', async () => {
      prisma.submission.findUnique = jest.fn().mockResolvedValue({
        id: 'sub-1',
        submittedBy: 'user-1',
        status: 'REJECTED',
      });

      await expect(service.resubmit('user-1', 'sub-1')).rejects.toThrow();
    });

    it('resubmit initiates workflow from resubmitTargetState if configured', async () => {
      prisma.submission.findUnique = jest.fn().mockResolvedValue({
        id: 'sub-1',
        submittedBy: 'user-1',
        status: 'RETURNED',
        form: { schema: {} },
        workflows: [],
        revisionNumber: 1,
      });
      validationEngine.validate.mockReturnValue([]);
      prisma.workflowDefinition.findFirst = jest.fn().mockResolvedValue({
        id: 'def-1',
        config: { initialState: 'STATE_A', resubmitTargetState: 'STATE_B' },
      });
      prisma.user.findUnique = jest
        .fn()
        .mockResolvedValue({ tenantId: 'tenant-1' });

      const tx = {
        workflowInstance: { update: jest.fn() },
        submission: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 'sub-2', revisionNumber: 2 }),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
        },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

      await service.resubmit('user-1', 'sub-1');

      expect(workflowEngine.initiate).toHaveBeenCalledWith(
        tx,
        'sub-2',
        expect.any(Object),
        expect.any(Object),
        'STATE_B',
      );
    });
  });
});
