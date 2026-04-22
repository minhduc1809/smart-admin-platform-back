import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'newuser@system.com' })
  @IsEmail({}, { message: 'validation.INVALID' })
  email: string;

  @ApiProperty({ example: 'newuser' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'User@123' })
  @IsString({ message: 'validation.MUST_BE_STRING' })
  @MinLength(6, { message: 'validation.MIN_LENGTH' })
  password: string;

  @ApiProperty({ example: 'John', required: false })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  lastName: string;
}
