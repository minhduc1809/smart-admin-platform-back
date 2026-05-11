import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ExecuteActionDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID()
  @IsNotEmpty()
  submissionId: string;

  @ApiProperty({
    example: 'approve',
    description:
      'Action to execute (approve, reject, cancel, return_for_edit, resubmit)',
  })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional({ example: 'Looks good, approved.' })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({
    description: 'Updated form data (only used with resubmit action)',
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}
