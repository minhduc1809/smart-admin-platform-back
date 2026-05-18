import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class ResubmitDto {
  @ApiPropertyOptional({ description: 'New data for the submission revision' })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
