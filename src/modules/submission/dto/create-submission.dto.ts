import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString, IsUUID } from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID()
  @IsNotEmpty()
  formId: string;

  @ApiProperty({
    example: {
      ly_do: 'Việc gia đình',
      so_ngay: 2,
    },
    description: 'Dữ liệu nộp form dựa trên schema của form',
  })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;
}
