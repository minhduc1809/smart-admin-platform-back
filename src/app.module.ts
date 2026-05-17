import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as path from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { FormModule } from './modules/form/form.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { KeycloakSyncGuard } from './common/guards/keycloak-sync.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { SubmissionModule } from './modules/submission/submission.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { FileModule } from './modules/file/file.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '../i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang']),
      ],
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    FormModule,
    SubmissionModule,
    WorkflowModule,
    FileModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: KeycloakSyncGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule { }
