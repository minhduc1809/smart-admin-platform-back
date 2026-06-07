import { Module } from '@nestjs/common';
import { DelegationService } from './delegation.service';
import { DelegationController } from './delegation.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [DelegationController],
  providers: [DelegationService],
  exports: [DelegationService],
})
export class DelegationModule {}
