import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { RedisService } from '@ocean.chat/redis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Strategy } from 'passport-jwt';

import { getAccessSessionKey } from '../common/utils/session.utils';
import { UsersService } from '../users/users.service';
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
    private readonly i18nService: I18nService,
    private readonly configService: ConfigService,
    @InjectPinoLogger('ocean.chat.auth.jwt.strategy')
    private readonly logger: PinoLogger,
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
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
  }): Promise<{
    username: string;
    sub: string;
  }> {
    const key = getAccessSessionKey(payload.jti);
    // The `redisService` has a circuit breaker. If Redis is down, `get` will throw an error,
    // which will be caught by the `JwtAuthGuard` and result in an authentication failure.
    // This aligns with the strategy of failing the operation if Redis is unavailable.
    const sessionExists = await this.redisService.get(key);
    if (sessionExists) {
      // Cache Hit: Token is in the whitelist, validation successful.
      return { sub: payload.sub, username: payload.username };
    }
    throw new BaseRpcException(
      this.i18nService.translate('JWT_Revoked'),
      ErrorCodes.UNAUTHORIZED,
    );
  }
}
