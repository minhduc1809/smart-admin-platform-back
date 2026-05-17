import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateWorkflowDefinitionDto {
  @ApiPropertyOptional({ example: 'Leave Request Workflow' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsOptional()
  @IsUUID()
  formId?: string;

  @ApiPropertyOptional({
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
      ],
    },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
