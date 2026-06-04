import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class SubmissionFilterDto {
  @ApiPropertyOptional({
    enum: SubmissionStatus,
    description: 'Lọc theo trạng thái form',
  })
  @IsEnum(SubmissionStatus)
  @IsOptional()
  status?: SubmissionStatus;

  @ApiPropertyOptional({ description: 'Lọc theo ID form cụ thể' })
  @IsUUID()
  @IsOptional()
  formId?: string;

  @ApiPropertyOptional({ description: 'Trang hiện tại (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng record mỗi trang',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
