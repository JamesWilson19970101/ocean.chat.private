import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { RedisService } from '@ocean.chat/redis';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { getAccessSessionKey } from '../../common/utils/session.utils';

export interface JwtPayload {
  username: string;
  sub: string; // User ID
  jti: string; // JWT ID for session management
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
    // Optional: Check if the token's JTI is still valid in Redis (for revocation)
    // This adds a Redis lookup for every protected request.
    // Consider if this is strictly necessary for your use case, given short-lived access tokens.
    const key = getAccessSessionKey(payload.jti);
    const sessionExists = await this.redisService.get(key);
    if (sessionExists) {
      // Cache Hit: Token is in the whitelist, validation successful.
      return { sub: payload.sub, username: payload.username };
    }
    return false;
  }
}
