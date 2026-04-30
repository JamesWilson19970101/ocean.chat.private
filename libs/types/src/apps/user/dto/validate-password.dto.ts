import { IsNotEmpty, IsString } from 'class-validator';

export class ValidatePasswordDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
