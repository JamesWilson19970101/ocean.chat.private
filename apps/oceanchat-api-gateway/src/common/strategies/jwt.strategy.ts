import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AuthKeyUtil } from '@ocean.chat/cores';
import { RedisService } from '@ocean.chat/redis';
import { IJwtPayload, ITokenStorage } from '@ocean.chat/types';
import { ExtractJwt, Strategy } from 'passport-jwt';

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

  async validate(payload: IJwtPayload): Promise<
    | {
        username: string;
        sub: string;
        deviceId: string;
      }
    | boolean
  > {
    const key = AuthKeyUtil.getUserKey(payload.sub);
    // Check the whitelist in Redis Hash: auth:user:{userId} -> field: {deviceId}
    const storage = await this.redisService.hget(key, payload.deviceId);

    if (!storage) {
      return false;
    }
    const tokenStorage = JSON.parse(storage) as ITokenStorage;
    // Compare the JTI to ensure the token hasn't been refreshed/revoked
    if (tokenStorage.accessJti !== payload.jti) {
      return false;
    }

    return {
      sub: payload.sub,
      username: payload.username,
      deviceId: payload.deviceId,
    };
  }
}
