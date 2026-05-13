export interface WorkflowTransitionCondition {
  requireComment?: boolean;
}

export interface WorkflowTransition {
  from: string | string[];
  to: string;
  action: string;
  roles?: string[];
  conditions?: WorkflowTransitionCondition;
}

export interface WorkflowConfig {
  states: string[];
  initialState: string;
  finalStates: string[];
  transitions: WorkflowTransition[];
}
