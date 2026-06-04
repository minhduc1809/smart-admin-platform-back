import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateFormDto {
  @ApiProperty({ example: 'Survey 2024' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Annual employee survey' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: {
      formId: 'form_xin_nghi_phep',
      fields: [
        {
          key: 'ly_do',
          label: 'Lý do xin nghỉ',
          type: 'text',
          rules: { required: true, minLength: 10, maxLength: 500 },
        },
        {
          key: 'so_ngay',
          label: 'Số ngày xin nghỉ',
          type: 'number',
          rules: { required: true, min: 1, max: 30 },
        },
      ],
    },
  })
  @IsObject()
  @IsNotEmpty()
  schema: any;

  @ApiPropertyOptional({ example: { allowAnonymous: false } })
  @IsOptional()
  @IsObject()
  settings?: any;
}
