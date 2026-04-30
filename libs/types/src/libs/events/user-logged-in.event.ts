import { IsDateString, IsString } from 'class-validator';

export class UserLoggedInEvent {
  @IsString()
  userId: string;

  @IsString()
  deviceId: string;

  @IsDateString()
  loginTime: string;
}
