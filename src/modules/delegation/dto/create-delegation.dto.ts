import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateDelegationDto {
  @ApiProperty({ example: 'cmpsw4oel0001m9yz06krowg8' })
  @IsString()
  @IsNotEmpty()
  fromUserId: string;

  @ApiProperty({ example: 'cmpsw4ofk000bm9yzmh469u4c' })
  @IsString()
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

  @ApiProperty({
    example: [],
    required: false,
    description: 'Restrict to specific form IDs. Empty = all forms.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  formIds?: string[];

  @ApiProperty({
    example: [],
    required: false,
    description:
      'Restrict to specific workflow definition IDs. Empty = all workflows.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  workflowDefinitionIds?: string[];
}
