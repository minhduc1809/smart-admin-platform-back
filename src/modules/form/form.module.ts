import { Module } from '@nestjs/common';
import { FormService } from './form.service';
import { FormController } from './form.controller';
import { ValidationEngine } from './validation.engine';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FormController],
  providers: [FormService, ValidationEngine],
  exports: [FormService, ValidationEngine],
})
export class FormModule {}
