import { SubmissionStatus } from '@prisma/client';

export interface WorkflowTransitionCondition {
  requireComment?: boolean;
}

export interface WorkflowTransition {
  from: string | string[];
  to: string;
  action: string;
  roles?: string[];
  conditions?: WorkflowTransitionCondition;
  submissionStatus?: SubmissionStatus;
}

export interface WorkflowConfig {
  states: string[];
  initialState: string;
  finalStates: string[];
  transitions: WorkflowTransition[];
  statusMapping?: Record<string, SubmissionStatus>;
}
