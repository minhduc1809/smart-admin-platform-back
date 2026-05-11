import { Module } from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { SubmissionController } from './submission.controller';
import { FormModule } from '../form/form.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [FormModule, WorkflowModule],
  controllers: [SubmissionController],
  providers: [SubmissionService],
  exports: [SubmissionService],
})
export class SubmissionModule {}
