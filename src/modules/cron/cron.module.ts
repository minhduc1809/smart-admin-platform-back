import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { NotificationModule } from '../notification/notification.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [NotificationModule, WorkflowModule],
  providers: [CronService],
})
export class CronModule {}
