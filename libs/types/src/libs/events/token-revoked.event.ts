import { IsNumber, IsString } from 'class-validator';

export class TokenRevokedEvent {
  @IsString()
  jti: string;

  @IsNumber()
  exp: number;
}
