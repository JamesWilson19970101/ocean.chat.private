import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
export class SignInDto {
  @IsNotEmpty()
  @IsString()
  readonly username: string;
  @IsNotEmpty()
  @MinLength(8, {
    // TODO: use i18n module translate message
    message: 'PASS_TOO_SHORT',
  })
  @IsString()
  readonly password: string;
}
export class SignUpDto {
  @IsString()
  readonly name: string;
  @IsNotEmpty()
  @IsString()
  readonly username: string;
  @IsNotEmpty()
  @IsString()
  readonly password: string;
  @IsEmail()
  @IsString()
  readonly email?: string;
}
