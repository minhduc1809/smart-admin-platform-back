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
});
