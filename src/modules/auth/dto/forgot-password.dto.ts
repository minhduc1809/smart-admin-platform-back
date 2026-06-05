import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@system.com' })
  @IsEmail({}, { message: 'validation.INVALID_EMAIL' })
  email!: string;
}
