import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [CronService],
})
export class CronModule {}

