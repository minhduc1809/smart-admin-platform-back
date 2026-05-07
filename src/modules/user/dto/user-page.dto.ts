import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UserPageDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    type: 'object',
    description: 'Base where condition',
    additionalProperties: true,
  })
  @IsOptional()
  condition?: Record<string, any>;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'Filter rules',
  })
  @IsOptional()
  filters?: any[];

  @ApiPropertyOptional({
    type: 'object',
    description: 'Sort definition or sort list',
    additionalProperties: true,
  })
  @IsOptional()
  sort?: any;
}
