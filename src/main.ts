import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './modules/realtime/adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Setup Global Prefix
  app.setGlobalPrefix('');

  // 2. Enable Validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // 3. Enable Global Exception Filter
  const i18nService = app.get<I18nService<any>>(I18nService);
  app.useGlobalFilters(new HttpExceptionFilter(i18nService));

  // 4. Config Swagger
  const config = new DocumentBuilder()
    .setTitle('SaaS Admin Backend API')
    .setDescription('Tài liệu API tích hợp chuẩn RESTful cho Dashboard')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // 5. Config CORS
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: false,
  });

  // 6. Config Redis WebSocket Adapter
  const configService = app.get(ConfigService);
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(
    configService.get('REDIS_HOST', 'localhost'),
    configService.get('REDIS_PORT', 6379),
    configService.get('REDIS_PASSWORD') || undefined,
  );
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server is running on: http://localhost:${port}`);
  console.log(`📚 Swagger Docs is running on: http://localhost:${port}/api`);
}
bootstrap();
