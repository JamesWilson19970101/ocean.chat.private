import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
export class SignInDto {
  @ApiProperty({ example: 'james@123.com' })
  @IsNotEmpty()
  @IsString()
  readonly username: string;

  @ApiProperty({ example: '12345678' })
  @IsNotEmpty()
  @MinLength(8, {
    // TODO: use i18n module translate message
    message: 'PASS_TOO_SHORT',
  })
  @IsString()
  readonly password: string;
}
export class SignUpDto {
  @ApiProperty({
    example: 'james@123.com',
  })
  @IsEmail()
  @IsString()
  readonly email: string;

  @ApiProperty()
  readonly username?: string;

  @ApiProperty({ example: '12345678' })
  @IsNotEmpty()
  @IsString()
  readonly password: string;
}
