import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@system.com' })
  @IsEmail({}, { message: 'validation.INVALID' })
  email: string;

  @ApiProperty({ example: 'User@123' })
  @IsString({ message: 'validation.MUST_BE_STRING' })
  @MinLength(6, { message: 'validation.MIN_LENGTH' })
  password: string;
}
