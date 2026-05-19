import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventListener } from './listeners/realtime-event.listener';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    ConfigModule,
  ],
  providers: [RealtimeGateway, RealtimeEventListener],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
