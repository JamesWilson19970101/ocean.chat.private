import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import { NatsJetStreamProvisionerService } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisService } from '@ocean.chat/redis';
import { Counter, metrics } from '@opentelemetry/api';
import * as ms from 'ms';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';

import { LoginResult, RefreshTokenResult } from './common/types/auth.types';
import {
  getAccessSessionKey,
  getRefreshSessionKey,
} from './common/utils/session.utils';
import { UsersService } from './users/users.service';

@Injectable()
export class OceanchatAuthService implements OnModuleInit {
  private loginCounter: Counter;
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly natsProvisioner: NatsJetStreamProvisionerService,
    private readonly i18nService: I18nService,
    @InjectPinoLogger('oceanchat.auth.service')
    private readonly logger: PinoLogger,
  ) {}
  onModuleInit() {
    const meter = metrics.getMeter('oceanchat-auth');
    this.loginCounter = meter.createCounter('auth.logins.total', {
      description: 'Total number of successful user logins',
    });
  }

  /**
   * Generates a JWT with a jti and store the jti in redis for whitelisting.
   * This is called by the AuthController after the LocalStrategy has successfully validated the user.
   * @param user The user object, validated by LocalStrategy.
   * @returns An object containing the access token, refresh token, and user information.
   */
  async login(user: Pick<User, 'username' | '_id'>): Promise<LoginResult> {
    this.logger.info(
      { userId: user._id },
      this.i18nService.translate('User_Login_Successful', {
        username: user.username,
      }),
    );
    this.loginCounter.add(1, { 'login.method': 'password' });
    // generate accessToken & refreshToken if `@UseGuards(JwtAuthGuard)` runs successfully.
    const [accessToken, refreshToken] = await this.generateTokens(user);

    // Publish a domain event to NATS JetStream for other services to consume.
    const js = this.natsProvisioner.getJetStreamClient();
    if (js) {
      // Fire-and-forget: publish the event but don't await it.
      // Attach a .catch() to handle potential errors (e.g., NATS server is down)
      // and prevent an unhandled promise rejection, while not blocking the login response.
      void js
        .publish(
          'auth.event.user.loggedIn',
          JSON.stringify({
            userId: user._id,
            loginTime: new Date().toISOString(),
          }),
        )
        .catch((err) => {
          // TODO: Set up a logging system and record the error.
          // This exception will not be caught by AllExceptionsFilter. Since it occurs in a separate, unawaited Promise chain, it becomes a detached unhandledRejection, which is exactly what we want to avoid.
          this.logger.error(
            { userId: user._id, err },
            this.i18nService.translate('FAILED_TO_PUBLISH_LOGGEDIN_EVENT'),
          );
        });
    }
    return { accessToken, refreshToken, user };
  }

  /**
   * Generates new access and refresh tokens using a valid refresh token.
   * Implements sliding session for refresh tokens.
   * @param oldRefreshToken The expired or soon-to-expire refresh token.
   * @returns A new pair of access and refresh tokens.
   */
  async refreshToken(oldRefreshToken: string): Promise<RefreshTokenResult> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch (error) {
      // If the refresh token is invalid or expired, deny access.
      throw new BaseRpcException(
        this.i18nService.translate('UNAUTHORIZED'),
        ErrorCodes.UNAUTHORIZED,
        { cause: error },
      );
    }

    const { sub: userId, jti } = payload;
    const sessionKey = getRefreshSessionKey(jti);

    // Atomically get the session value and delete the key using a Lua script.
    // This prevents the race condition you identified, where multiple concurrent requests
    // could use the same refresh token. The first request will get the session and
    // delete the key. Any subsequent requests will get `nil` and be rejected.
    const LUA_SCRIPT_GET_AND_DELETE = `
      local value = redis.call('get', KEYS[1])
      if value then
        redis.call('del', KEYS[1])
      end
      return value
    `;

    const storedValue = await this.redisService.eval(
      LUA_SCRIPT_GET_AND_DELETE,
      [sessionKey], // KEYS array
      [], // ARGV array
    );

    if (!storedValue) {
      // If the token is not in Redis, it means it has been used by a concurrent request,
      // revoked, or the session has expired from Redis TTL.
      // I return a specific error code to differentiate this from a fundamentally invalid token
      // (which fails at the jwt.verifyAsync step).
      // This allows the frontend to handle race conditions gracefully (e.g., by ignoring this
      // specific error and waiting for the successful concurrent request's response)
      // instead of logging the user out immediately.
      throw new BaseRpcException(
        this.i18nService.translate('REFRESH_TOKEN_REUSED_OR_REVOKED'),
        ErrorCodes.REFRESH_TOKEN_REUSED_OR_REVOKED,
        {
          userId,
          jti,
        },
      );
    }

    // Fetch user to generate new tokens
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new BaseRpcException(
        this.i18nService.translate('User_not_found'),
        ErrorCodes.UNAUTHORIZED,
        {
          userId,
          jti,
          reason: this.i18nService.translate('User_Not_Found_With_Valid_Token'),
        },
      );
    }

    // Issue a new pair of tokens
    const [newAccessToken, newRefreshToken] = await this.generateTokens({
      username: user.username as string,
      _id: user._id,
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Generates and stores a new pair of access and refresh tokens for a user.
   * @param user The user to generate tokens for.
   * @returns A tuple containing the new [accessToken, refreshToken].
   */
  private async generateTokens(
    user: Pick<User, 'username' | '_id'>,
  ): Promise<[string, string]> {
    const userId = user._id as string;
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessTokenPayload = {
      username: user.username,
      sub: userId,
      jti: accessJti,
    };
    const refreshTokenPayload = { sub: userId, jti: refreshJti };

    const accessExpiresIn = this.configService.get<string>(
      'jwt.accessExpiresIn',
    ) as `${number}${ms.Unit}`;
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) as `${number}${ms.Unit}`;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    try {
      // Atomically store both tokens' JTIs in Redis using a transaction (MULTI/EXEC).
      // This ensures that either both keys are set successfully, or neither is,
      // preventing a partial state where only one token is valid.
      const accessExpiresInSeconds = ms(accessExpiresIn) / 1000;
      const refreshExpiresInSeconds = ms(refreshExpiresIn) / 1000;

      await this.redisService
        .getClient()
        .multi()
        .set(
          getAccessSessionKey(accessJti),
          userId,
          'EX',
          accessExpiresInSeconds,
        )
        .set(
          getRefreshSessionKey(refreshJti),
          userId,
          'EX',
          refreshExpiresInSeconds,
        )
        .exec();

      return [accessToken, refreshToken];
    } catch (error) {
      // If storing the session in Redis fails, I should not issue the token.
      // This prevents issuing a token that can never be validated.
      throw new BaseRpcException(
        this.i18nService.translate('Login_Session_Store_Failed'),
        ErrorCodes.UNEXPECTED_ERROR,
        { cause: error },
      );
    }
  }

  /**
   * Validates a JWT.
   * @param token The token to validate.
   * @returns The decoded payload if valid, otherwise null.
   */
  async validateToken(token: string): Promise<any> {
    try {
      return await this.jwtService.verifyAsync(token);
    } catch {
      return null;
    }
  }

  /**
   * decode the token
   * @param token token used for decode
   * @returns
   */
  decodeToken(token: string): Record<string, unknown> | null {
    return this.jwtService.decode(token);
  }
}
