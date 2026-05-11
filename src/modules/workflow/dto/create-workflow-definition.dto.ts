import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateWorkflowDefinitionDto {
  @ApiProperty({ example: 'Leave Request Workflow' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID()
  @IsOptional()
  formId?: string;

  @ApiProperty({
    example: {
      states: ['pending_manager', 'pending_hr', 'approved', 'rejected'],
      initialState: 'pending_manager',
      finalStates: ['approved', 'rejected'],
      transitions: [
        {
          from: 'pending_manager',
          to: 'pending_hr',
          action: 'approve',
          roles: ['MANAGER'],
        },
        {
          from: 'pending_hr',
          to: 'approved',
          action: 'approve',
          roles: ['ADMIN'],
        },
        {
          from: '*',
          to: 'rejected',
          action: 'reject',
          roles: ['MANAGER', 'ADMIN'],
        },
      ],
    },
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, any>;
}
