import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyResetOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'validation.INVALID_EMAIL' })
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString({ message: 'validation.MUST_BE_STRING' })
  @Length(6, 6, { message: 'validation.INVALID_OTP' })
  @Matches(/^\d{6}$/, { message: 'validation.INVALID_OTP' })
  otp!: string;
}
