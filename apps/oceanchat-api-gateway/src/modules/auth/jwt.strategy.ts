import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  username: string;
  sub: string; // User ID
  jti: string; // JWT ID for session management
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') as string,
    });
  }

  validate(payload: JwtPayload):
    | {
        username: string;
        sub: string;
      }
    | boolean {
    // Passport-JWT has already verified the signature and expiration.
    // Since I want a stateless verification (no DB/Redis lookup),
    // I simply return the user info extracted from the token.
    // As long as attackers don't have your JWT_ACCESS_SECRET, they cannot forge a signed token.
    // Expired tokens will also be automatically rejected by passport-jwt and will not enter the validate method.
    return { sub: payload.sub, username: payload.username };
  }
}
