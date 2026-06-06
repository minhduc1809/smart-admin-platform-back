import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterTenantDto {
  @ApiProperty({ example: 'My New Company' })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty({ example: 'my-new-company' })
  @IsString()
  @IsNotEmpty()
  domain!: string;

  @ApiProperty({ example: 'admin@mycompany.com' })
  @IsEmail({}, { message: 'validation.INVALID' })
  @IsNotEmpty()
  adminEmail!: string;

  @ApiProperty({ example: 'adminusername' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'validation.MIN_LENGTH' })
  adminUsername!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString({ message: 'validation.MUST_BE_STRING' })
  @IsNotEmpty()
  @MinLength(8, { message: 'validation.MIN_LENGTH' })
  adminPassword!: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  adminFirstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  adminLastName?: string;
}
