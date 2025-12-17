import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { AuthKeyUtil } from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import { NatsJetStreamProvisionerService } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisService } from '@ocean.chat/redis';
import { IJwtPayload, ITokenStorage } from '@ocean.chat/types';
import { LoginResult, RefreshTokenResult } from '@ocean.chat/types';
import { Counter, metrics } from '@opentelemetry/api';
import * as ms from 'ms';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';

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
  async login(
    user: Pick<User, 'username' | '_id'>,
    deviceId: string,
  ): Promise<LoginResult> {
    this.logger.info(
      { userId: user._id, deviceId },
      this.i18nService.translate('User_Login_Successful', {
        username: user.username,
      }),
    );
    this.loginCounter.add(1, { 'login.method': 'password' });
    // generate accessToken & refreshToken if `@UseGuards(JwtAuthGuard)` runs successfully.
    const [accessToken, refreshToken] = await this.generateTokens(
      user,
      deviceId,
    );

    // Publish a domain event to NATS JetStream for other services to consume.
    const js = this.natsProvisioner.getJetStreamClient();
    if (js) {
      // Fire-and-forget: publish the event but don't await it.
      // Attach a .catch() to handle potential errors (e.g., NATS server is down)
      // and prevent an unhandled promise rejection, while not blocking the login response.
      // TODO: Distributed tracing integration for NATS publishing
      void js
        .publish(
          'auth.event.user.loggedIn',
          JSON.stringify({
            userId: user._id,
            deviceId,
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
   * Logs out a user from a specific device by removing the session from Redis.
   * @param userId The user ID.
   * @param deviceId The device ID.
   */
  async logout(userId: string, deviceId: string): Promise<number> {
    const userKey = AuthKeyUtil.getUserKey(userId);
    return await this.redisService.hdel(userKey, deviceId);
  }

  /**
   * Generates new access and refresh tokens using a valid refresh token.
   * Implements sliding session for refresh tokens.
   * @param oldRefreshToken The expired or soon-to-expire refresh token.
   * @returns A new pair of access and refresh tokens.
   */
  async refreshToken(oldRefreshToken: string): Promise<RefreshTokenResult> {
    let payload: IJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<IJwtPayload>(
        oldRefreshToken,
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
        },
      );
    } catch (error) {
      // If the underlying layer has already packaged the error (e.g., failure to obtain role, database connection timeout, etc.),
      // this means that the underlying layer has a clear definition of the error, and the upper layer should directly "pass it through" without tampering with it.
      if (error instanceof BaseRpcException) {
        throw error;
      }
      // If the refresh token is invalid or expired, deny access.
      // Only those "unexpected" errors or errors that actually belong to the current level of semantics (such as the native JsonWebTokenError thrown by verify token) are uniformly wrapped.
      throw new BaseRpcException(
        this.i18nService.translate('UNAUTHORIZED'),
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        { cause: error },
      );
    }

    const { sub: userId, jti, deviceId } = payload;
    const userKey = AuthKeyUtil.getUserKey(userId);

    // Check if the device session exists in Redis Hash
    const storage = await this.redisService.hget<ITokenStorage>(
      userKey,
      deviceId,
    );

    if (!storage || storage.refreshJti !== jti) {
      // If storage is missing, the user was kicked out or expired.
      // If JTI mismatch, the token was already refreshed (reuse attempt) or replaced.
      // I return a specific error code to differentiate this from a fundamentally invalid token
      // (which fails at the jwt.verifyAsync step).
      // This allows the frontend to handle race conditions gracefully (e.g., by ignoring this
      // specific error and waiting for the successful concurrent request's response)
      // instead of logging the user out immediately.
      throw new BaseRpcException(
        this.i18nService.translate('REFRESH_TOKEN_REUSED_OR_REVOKED'),
        HttpStatus.UNAUTHORIZED,
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
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        {
          userId,
          jti,
          reason: this.i18nService.translate('User_Not_Found_With_Valid_Token'),
        },
      );
    }

    // Issue a new pair of tokens
    const [newAccessToken, newRefreshToken] = await this.generateTokens(
      {
        username: user.username as string,
        _id: user._id,
      },
      deviceId,
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Generates and stores a new pair of access and refresh tokens for a user.
   * @param user The user to generate tokens for.
   * @param deviceId The device identifier.
   * @returns A tuple containing the new [accessToken, refreshToken].
   */
  private async generateTokens(
    user: Pick<User, 'username' | '_id'>,
    deviceId: string,
  ): Promise<[string, string]> {
    const userId = user._id as string;
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessTokenPayload: IJwtPayload = {
      username: user.username,
      sub: userId,
      jti: accessJti,
      deviceId,
    };

    const refreshTokenPayload: IJwtPayload = {
      sub: userId,
      jti: refreshJti,
      username: user.username,
      deviceId,
    };

    const accessExpiresIn = this.configService.get<string>(
      'jwt.accessExpiresIn',
    ) as `${number}${ms.Unit}`;
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) as `${number}${ms.Unit}`;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    const tokenStorage: ITokenStorage = {
      accessToken,
      refreshToken,
      accessJti,
      refreshJti,
      lastActive: Date.now(),
    };

    try {
      // Atomically store both tokens' JTIs in Redis using a transaction (MULTI/EXEC).
      // This ensures that either both keys are set successfully, or neither is,
      // preventing a partial state where only one token is valid.

      // Store the token info in the Redis Hash: auth:user:{userId} -> {deviceId}
      const userKey = AuthKeyUtil.getUserKey(userId);

      const refreshTtl = ms(refreshExpiresIn) / 1000;

      // Add jitter to TTLs to prevent mass expiry (cache avalanche)
      // e.g., add up to 10% of the original TTL as random jitter.
      const refreshExpiresInSeconds =
        refreshTtl + Math.floor(Math.random() * refreshTtl * 0.1);

      await this.redisService
        .getClient()
        .multi()
        .hset(userKey, deviceId, JSON.stringify(tokenStorage))
        .expire(userKey, refreshExpiresInSeconds)
        .exec();

      return [accessToken, refreshToken];
    } catch (error) {
      if (error instanceof BaseRpcException) {
        throw error;
      }
      // If storing the session in Redis fails, I should not issue the token.
      // This prevents issuing a token that can never be validated.
      throw new BaseRpcException(
        this.i18nService.translate('Login_Session_Store_Failed'),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.UNEXPECTED_ERROR,
        { cause: error },
      );
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
