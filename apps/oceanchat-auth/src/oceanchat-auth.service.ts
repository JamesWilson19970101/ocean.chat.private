import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { AuthKeyUtil } from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import { BoundedPublisherService } from '@ocean.chat/nats-jetstream-provisioner';
import { NatsJetStreamProvisionerService } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisService } from '@ocean.chat/redis';
import { IJwtPayload, ITokenStorage } from '@ocean.chat/types';
import { LoginResult, RefreshTokenResult } from '@ocean.chat/types';
import { AuthenticatedUser } from '@ocean.chat/types';
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
    private readonly boundedPublisher: BoundedPublisherService,
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
    user: Pick<AuthenticatedUser, 'username' | '_id' | 'deviceId'>,
  ): Promise<LoginResult> {
    this.logger.info(
      { userId: user._id, deviceId: user.deviceId },
      this.i18nService.translate('User_Login_Successful', {
        username: user.username,
      }),
    );
    this.loginCounter.add(1, { 'login.method': 'password' });
    // generate accessToken & refreshToken if `@UseGuards(JwtAuthGuard)` runs successfully.
    const [accessToken, refreshToken] = await this.generateTokens(user);
    // Fire-and-forget: publish the event but don't await it.
    // The BoundedPublisherService will handle backpressure and DLQ internally.
    // The .catch() here only handles the case where the internal queue is full.
    void this.boundedPublisher
      .publishSafe(
        'auth.event.user.loggedIn',
        {
          pattern: 'auth.event.user.loggedIn',
          data: {
            userId: user._id,
            deviceId: user.deviceId,
            loginTime: new Date().toISOString(),
          },
        },
        'login_event',
        { isCritical: false },
      )
      .catch((err) => {
        this.logger.error(
          { userId: user._id, err },
          this.i18nService.translate('FAILED_TO_PUBLISH_LOGGEDIN_EVENT'),
        );
      });
    return { accessToken, refreshToken, user };
  }

  /**
   * Logs out a user from a specific device by removing the session from Redis.
   * @param userId The user ID.
   * @param deviceId The device ID.
   */
  async logout(userId: string, deviceId: string): Promise<number> {
    const userKey = AuthKeyUtil.getUserKey(userId);

    // Zero-I/O Authentication: Broadcast token revocation to Gateways
    try {
      const sessionStr = await this.redisService.hget(userKey, deviceId);
      if (sessionStr) {
        const session: ITokenStorage = JSON.parse(sessionStr);
        const decodedAT: IJwtPayload = this.jwtService.decode(
          session.accessToken,
        );

        if (session.accessJti && decodedAT?.exp) {
          void this.boundedPublisher
            .publishSafe(
              'auth.jwt.revoke',
              {
                pattern: 'auth.jwt.revoke',
                data: {
                  jti: session.accessJti,
                  exp: decodedAT.exp,
                },
              },
              'logout_event',
              { isCritical: true },
            )
            .catch((err) => {
              this.logger.error(
                { userId, deviceId, err },
                this.i18nService.translate(
                  'FAILED_TO_PUBLISH_REVOKE_EVENT_LOGOUT',
                ),
              );
            });
        }
      }
    } catch (e) {
      this.logger.error(
        { userId, deviceId, e },
        this.i18nService.translate(
          'FAILED_TO_PARSE_SESSION_OR_PUBLISH_REVOCATION',
        ),
      );
    }

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
          secret: this.configService.get<string>('jwt.refreshPublicKey'),
          algorithms: ['RS256'],
        },
      );
    } catch (error) {
      if (error instanceof BaseRpcException) {
        throw error;
      }
      throw new BaseRpcException(
        this.i18nService.translate('UNAUTHORIZED'),
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        { cause: error },
      );
    }

    const { sub: userId, jti, deviceId } = payload;
    const lockKey = `auth:refresh:lock:${userId}:${deviceId}`;

    // Attempt to acquire the lock independently.
    let isLockAcquired: string | null = null;
    try {
      isLockAcquired = await this.redisService.setnx(lockKey, '1', 10);
    } catch (error) {
      throw new BaseRpcException(
        this.i18nService.translate('Redis_Client_Error'),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.TOKEN_REFRESH_ERROR,
        { cause: error },
      );
    }

    if (isLockAcquired !== 'OK') {
      throw new BaseRpcException(
        this.i18nService.translate('REFRESH_TOKEN_REUSED_OR_REVOKED'),
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.REFRESH_TOKEN_REUSED_OR_REVOKED,
        { userId, jti },
      );
    }

    try {
      const userKey = AuthKeyUtil.getUserKey(userId);

      // Check if the device session exists in Redis Hash
      const storageStr = await this.redisService.hget(userKey, deviceId);

      if (!storageStr) {
        throw new BaseRpcException(
          this.i18nService.translate('REFRESH_TOKEN_REUSED_OR_REVOKED'),
          HttpStatus.UNAUTHORIZED,
          ErrorCodes.REFRESH_TOKEN_REUSED_OR_REVOKED,
          { userId, jti },
        );
      }

      let storage: ITokenStorage;
      try {
        storage = JSON.parse(storageStr);
      } catch (parseError) {
        this.logger.error(
          { userId, deviceId, parseError },
          this.i18nService.translate('CORRUPTED_SESSION_DATA_IN_REDIS'),
        );
        throw new BaseRpcException(
          this.i18nService.translate('REFRESH_TOKEN_REUSED_OR_REVOKED'),
          HttpStatus.UNAUTHORIZED,
          ErrorCodes.REFRESH_TOKEN_REUSED_OR_REVOKED,
          { userId, jti },
        );
      }

      if (storage.refreshJti !== jti) {
        // Replay Attack Detected!
        this.logger.warn(
          { userId, jti, deviceId },
          this.i18nService.translate('REPLAY_ATTACK_DETECTED'),
        );

        // Fetch all active sessions to revoke their Access Tokens
        const allSessions = await this.redisService.hgetall(userKey);
        if (allSessions) {
          Object.values(allSessions).forEach((sessStr) => {
            try {
              const sess = JSON.parse(sessStr) as ITokenStorage;
              const decodedAT: IJwtPayload = this.jwtService.decode(
                sess.accessToken,
              );
              if (sess.accessJti && decodedAT?.exp) {
                void this.boundedPublisher
                  .publishSafe(
                    'auth.jwt.revoke',
                    {
                      jti: sess.accessJti,
                      exp: decodedAT.exp,
                    },
                    'replay_attack_revoke_event',
                    { isCritical: true },
                  )
                  .catch((err) => {
                    this.logger.error(
                      { err, userId, jti: sess.accessJti },
                      this.i18nService.translate(
                        'FAILED_TO_PUBLISH_REVOKE_EVENT_REPLAY',
                      ),
                    );
                  });
              }
            } catch {
              // Ignore parse errors for individual sessions
            }
          });
        }

        // Delete all sessions for this user (family revocation)
        await this.redisService.del(userKey);

        throw new BaseRpcException(
          this.i18nService.translate('REFRESH_TOKEN_REUSED_OR_REVOKED'),
          HttpStatus.UNAUTHORIZED,
          ErrorCodes.REFRESH_TOKEN_REUSED_OR_REVOKED,
          { userId, jti },
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
            reason: this.i18nService.translate(
              'User_Not_Found_With_Valid_Token',
            ),
          },
        );
      }

      // Issue a new pair of tokens
      const [newAccessToken, newRefreshToken] = await this.generateTokens({
        username: user.username as string,
        _id: user._id,
        deviceId,
      });

      // Revoke the old access token since we've rotated it
      const decodedOldAT: IJwtPayload = this.jwtService.decode(
        storage.accessToken,
      );
      if (storage.accessJti && decodedOldAT?.exp) {
        void this.boundedPublisher
          .publishSafe(
            'auth.jwt.revoke',
            {
              jti: storage.accessJti,
              exp: decodedOldAT.exp,
            },
            'refresh_token_revoke_event',
            { isCritical: true },
          )
          .catch((err) => {
            this.logger.error(
              { err, userId },
              this.i18nService.translate(
                'FAILED_TO_PUBLISH_OLD_TOKEN_REVOCATION',
              ),
            );
          });
      }

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof BaseRpcException) {
        throw error;
      }
      throw new BaseRpcException(
        this.i18nService.translate('TOKEN_REFRESH_ERROR'),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.TOKEN_REFRESH_ERROR,
        {
          cause: error,
        },
      );
    } finally {
      await this.redisService.del(lockKey).catch((err) => {
        this.logger.error(
          { err, lockKey },
          this.i18nService.translate('Lock_Release_Failed'),
        );
      });
    }
  }

  /**
   * Generates and stores a new pair of access and refresh tokens for a user.
   * @param user The user to generate tokens for.
   * @param deviceId The device identifier.
   * @returns A tuple containing the new [accessToken, refreshToken].
   */
  private async generateTokens(
    user: Pick<AuthenticatedUser, 'username' | '_id' | 'deviceId'>,
  ): Promise<[string, string]> {
    const userId = user._id as string;
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessTokenPayload: IJwtPayload = {
      username: user.username,
      sub: userId,
      jti: accessJti,
      deviceId: user.deviceId,
    };

    const refreshTokenPayload: IJwtPayload = {
      sub: userId,
      jti: refreshJti,
      username: user.username,
      deviceId: user.deviceId,
    };

    const accessExpiresIn = this.configService.get<string>(
      'jwt.accessExpiresIn',
    ) as `${number}${ms.Unit}`;
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) as `${number}${ms.Unit}`;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        privateKey: this.configService.get<string>('jwt.accessPrivateKey'),
        expiresIn: accessExpiresIn,
        algorithm: 'RS256',
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        privateKey: this.configService.get<string>('jwt.refreshPrivateKey'),
        expiresIn: refreshExpiresIn,
        algorithm: 'RS256',
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
      const userKey = AuthKeyUtil.getUserKey(userId);
      const refreshTtl = ms(refreshExpiresIn) / 1000;

      // Add jitter to TTLs to prevent mass expiry (cache avalanche)
      const refreshExpiresInSeconds =
        refreshTtl + Math.floor(Math.random() * refreshTtl * 0.1);

      await this.redisService
        .getClient()
        .multi()
        .hset(userKey, user.deviceId, JSON.stringify(tokenStorage))
        .expire(userKey, refreshExpiresInSeconds)
        .exec();

      return [accessToken, refreshToken];
    } catch (error) {
      if (error instanceof BaseRpcException) {
        throw error;
      }
      throw new BaseRpcException(
        this.i18nService.translate('Login_Session_Store_Failed'),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.UNEXPECTED_ERROR,
        { cause: error },
      );
    }
  }

  decodeToken(token: string): Record<string, unknown> | null {
    return this.jwtService.decode(token);
  }
}
