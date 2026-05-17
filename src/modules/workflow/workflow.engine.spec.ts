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
      transitions: [
        { from: 'draft', to: 'submitted', action: 'submit' },
      ],
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

  it('isCompleted returns true for final states', () => {
    const config: WorkflowConfig = {
      states: ['draft', 'approved'],
      initialState: 'draft',
      finalStates: ['approved'],
      transitions: [
        { from: 'draft', to: 'approved', action: 'approve' },
      ],
    };

    expect(engine.isCompleted(config, 'approved')).toBe(true);
  });
});
