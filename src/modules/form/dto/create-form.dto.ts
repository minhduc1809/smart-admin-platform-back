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
      fields: [
        { name: 'fullName', label: 'Full Name', type: 'text', required: true },
        { name: 'age', label: 'Age', type: 'number' }
      ]
    }
  })
  @IsObject()
  @IsNotEmpty()
  schema: any;

  @ApiPropertyOptional({ example: { allowAnonymous: false } })
  @IsOptional()
  @IsObject()
  settings?: any;
}
