import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateFormDto {
  @ApiPropertyOptional({ example: 'Survey 2024' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Annual employee survey' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: {
      formId: 'form_xin_nghi_phep',
      fields: [
        {
          key: 'ly_do',
          label: 'Lý do xin nghỉ',
          type: 'text',
          rules: { required: true, minLength: 10, maxLength: 500 },
        },
      ],
    },
  })
  @IsOptional()
  @IsObject()
  schema?: any;

  @ApiPropertyOptional({ example: { allowAnonymous: false } })
  @IsOptional()
  @IsObject()
  settings?: any;
}
