import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'some_long_token_here' })
  @IsString({ message: 'validation.MUST_BE_STRING' })
  token!: string;

  @ApiProperty({ example: 'NewPassword@123' })
  @IsString({ message: 'validation.MUST_BE_STRING' })
  @MinLength(8, { message: 'validation.MIN_LENGTH' })
  newPassword!: string;
}
