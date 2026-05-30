import { SubmissionStatus } from '@prisma/client';

export interface WorkflowTransitionCondition {
  requireComment?: boolean;
}

export interface VotingConfig {
  approveAction: string;
  rejectAction: string;
  approveThreshold: number;
  rejectThreshold?: number;
  approveTarget: string;
  rejectTarget: string;
}

export interface WorkflowTransition {
  from: string | string[];
  to: string;
  action: string;
  roles?: string[];
  conditions?: WorkflowTransitionCondition;
  submissionStatus?: SubmissionStatus;
  type?: 'PARALLEL_JOIN' | 'VOTING';
  requireActions?: string[];
  votingConfig?: VotingConfig;
}

export interface WorkflowStateDetails {
  slaHours?: number;
  timeoutAction?: string;
}

export interface WorkflowConfig {
  states: string[];
  initialState: string;
  finalStates: string[];
  transitions: WorkflowTransition[];
  statusMapping?: Record<string, SubmissionStatus>;
  resubmitTargetState?: string;
  resubmitFastTrack?: boolean;
  statesDetails?: Record<string, WorkflowStateDetails>;
}
