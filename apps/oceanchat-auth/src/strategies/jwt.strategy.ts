import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { RedisService } from '@ocean.chat/redis';
import { Strategy } from 'passport-jwt';

import { getAccessSessionKey } from '../common/utils/session.utils';

const fromNatsPayload = (request: unknown): string | null => {
  if (
    request &&
    typeof request === 'object' &&
    'token' in request &&
    typeof (request as Record<string, unknown> & { token?: unknown }).token ===
      'string'
  ) {
    return (request as Record<string, unknown> & { token: string }).token;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: fromNatsPayload,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') as string,
    });
  }

  // This method is automatically called by the Passport framework after it has
  // successfully validated the token's signature and expiration.

  // TODO: use hybrid jwt. reference: https://jameswilson19970101.github.io/ocean.chat.docs/docs/devdocs/JWT
  async validate(payload: {
    username: string;
    sub: string;
    jti: string;
    iat: number;
  }): Promise<
    | {
        username: string;
        sub: string;
      }
    | boolean
  > {
    const key = getAccessSessionKey(payload.jti);
    // If Redis is down, `get` will throw an error,
    // which will be caught by the `JwtAuthGuard` and result in an authentication failure.
    // This aligns with the strategy of failing the operation if Redis is unavailable.
    const sessionExists = await this.redisService.get(key);
    // TODO: Event-driven Revocation List
    // Publish event on user status change: When a user is deleted or disabled, your UsersService (or other relevant service), after completing the database operation, will publish an event via NATS, such as user.revoked, with a payload of { userId: 'some-user-id' }.
    // Auth service listens for the event: The OceanchatAuthService listens for this user.revoked event.
    // Add to blacklist: Upon receiving the event, the OceanchatAuthService adds this userId to a "blacklist" Set in Redis and sets a reasonable expiration time (e.g., set it to the expiration time of your longest Refresh Token for automatic cleanup).
    // JwtStrategy checks the blacklist: Modify the JwtStrategy to add an additional step after checking the whitelist (access-session): check if the token's sub (i.e., the userId) exists in the Redis "blacklist".
    if (sessionExists) {
      // Cache Hit: Token is in the whitelist, validation successful.
      return { sub: payload.sub, username: payload.username };
    }
    return false;
  }
}
