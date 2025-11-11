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
    // This strategy implements a centralized JTI Whitelist validation.
    // It is intended for high-security operations or initial connection authentication (e.g., WebSocket)
    // where the overhead of an RPC call is acceptable for the highest level of security.
    // For high-frequency requests, services like an API gateway should use a hybrid model:
    // 1. Perform local JWT signature/expiration validation.
    // 2. Check against a locally cached revocation list (blacklist) for better performance.

    // So TODO: Future Consideration - Hybrid Model or Blacklist
    // For performance optimization, a blacklist (revocation list) or a hybrid model could be considered.
    // This would involve creating a list of revoked JTIs or user IDs in Redis, which would only be
    // checked for invalid tokens, reducing Redis lookups for valid ones. This could be driven by
    // events like `user.revoked` for immediate invalidation.
    const key = getAccessSessionKey(payload.jti);
    // If Redis is down, `get` will throw an error,
    // which will be caught by the `JwtAuthGuard` and result in an authentication failure.
    // This aligns with the strategy of failing the operation if Redis is unavailable.
    const sessionExists = await this.redisService.get(key);
    if (sessionExists) {
      // Cache Hit: Token is in the whitelist, validation successful.
      return { sub: payload.sub, username: payload.username };
    }
    return false;
  }
}
