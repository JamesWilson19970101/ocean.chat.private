import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;
}
