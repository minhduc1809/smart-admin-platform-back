import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ExportFilterDto {
  @ApiPropertyOptional({
    description:
      'ID của Form để lọc xuất dữ liệu. Nếu để trống sẽ xuất toàn bộ form.',
  })
  @IsString()
  @IsOptional()
  formId?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  toDate?: string;
}
