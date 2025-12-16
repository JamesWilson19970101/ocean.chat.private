import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { getAccessSessionKey } from '@ocean.chat/cores';
import { RedisService } from '@ocean.chat/redis';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  username: string;
  sub: string; // User ID
  jti: string; // JWT ID for session management
  iat: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // example: { Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 }
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<
    | {
        username: string;
        sub: string;
      }
    | boolean
  > {
    const key = getAccessSessionKey(payload.jti);
    const sessionExists = await this.redisService.get(key);
    if (sessionExists) {
      // Cache Hit: Token is in the whitelist, validation successful.
      return { sub: payload.sub, username: payload.username };
    }
    return false;
  }
}
