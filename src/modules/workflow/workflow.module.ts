import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkflowEngine } from './workflow.engine';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WorkflowActionService } from './workflow-action.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowEventListener } from './listeners/workflow-event.listener';
import { SubmissionModule } from '../submission/submission.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => SubmissionModule),
    NotificationModule,
  ],
  controllers: [WorkflowController],
  providers: [
    WorkflowEngine,
    WorkflowDefinitionService,
    WorkflowActionService,
    WorkflowEventListener,
  ],
  exports: [WorkflowEngine],
})
export class WorkflowModule {}
