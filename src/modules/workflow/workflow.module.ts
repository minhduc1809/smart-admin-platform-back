import { Module } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';

@Module({
  providers: [WorkflowEngine],
  exports: [WorkflowEngine],
})
export class WorkflowModule {}
