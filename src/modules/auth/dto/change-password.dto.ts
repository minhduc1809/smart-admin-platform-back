import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword@123' })
  @IsString({ message: 'validation.MUST_BE_STRING' })
  oldPassword!: string;

  @ApiProperty({ example: 'NewPassword@123' })
  @IsString({ message: 'validation.MUST_BE_STRING' })
  @MinLength(8, { message: 'validation.MIN_LENGTH' })
  newPassword!: string;
}
