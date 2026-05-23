import { IsString, IsArray, IsOptional, IsDateString } from 'class-validator';

export class ApiKeyDto {
  @IsString()
  name: string;

  @IsArray()
  scopes: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: Date;
}
