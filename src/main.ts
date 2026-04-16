import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { I18nService } from 'nestjs-i18n';

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
  app.enableCors();

  await app.listen(3000);
  console.log('🚀 Server is running on: http://localhost:3000');
  console.log('📚 Swagger Docs is running on: http://localhost:3000/api');
}
bootstrap();
