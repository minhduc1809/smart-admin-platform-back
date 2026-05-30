import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateDelegationDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID()
  @IsNotEmpty()
  fromUserId: string;

  @ApiProperty({ example: 'e39da12b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID()
  @IsNotEmpty()
  toUserId: string;

  @ApiProperty({ example: '2026-05-30T15:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2026-06-30T15:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: [], required: false, description: 'Restrict to specific form IDs. Empty = all forms.' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  formIds?: string[];

  @ApiProperty({ example: [], required: false, description: 'Restrict to specific workflow definition IDs. Empty = all workflows.' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  workflowDefinitionIds?: string[];
}
