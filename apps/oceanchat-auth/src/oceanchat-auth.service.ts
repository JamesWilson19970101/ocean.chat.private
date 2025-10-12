import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import * as ms from 'ms';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';

import {
  getAccessSessionKey,
  getRefreshSessionKey,
} from './common/utils/session.utils';
import { UsersService } from './users/users.service';
@Injectable()
export class OceanchatAuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
    @InjectPinoLogger('oceanchat.auth.service')
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Generates a JWT with a jti and store the jti in redis for whitelisting.
   * This is called by the AuthController after the LocalStrategy has successfully validated the user.
   * @param user The user object, validated by LocalStrategy.
   * @returns An object containing the access token, refresh token, and user information.
   */
  async login(user: Pick<User, 'username' | '_id'>): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Pick<User, 'username' | '_id'>;
  }> {
    const [accessToken, refreshToken] = await this.generateTokens(user);
    return { accessToken, refreshToken, user };
  }

  /**
   * Generates new access and refresh tokens using a valid refresh token.
   * Implements sliding session for refresh tokens.
   * @param oldRefreshToken The expired or soon-to-expire refresh token.
   * @returns A new pair of access and refresh tokens.
   */
  async refreshToken(oldRefreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch (error) {
      this.logger.warn(
        { err: error },
        this.i18nService.translate('Refresh_Token_Failed'),
      );
      // If the refresh token is invalid or expired, deny access.
      throw new BaseRpcException(
        this.i18nService.translate('UNAUTHORIZED'),
        ErrorCodes.UNAUTHORIZED,
      );
    }

    const { sub: userId, jti } = payload;
    const sessionKey = getRefreshSessionKey(jti);

    // Check if the refresh token is in our whitelist (i.e., it's valid and not used)
    const sessionExists = await this.redisService.get(sessionKey);
    if (!sessionExists) {
      // If not in Redis, it's been revoked, used, or expired.
      throw new BaseRpcException(
        this.i18nService.translate('UNAUTHORIZED'),
        ErrorCodes.UNAUTHORIZED,
      );
    }

    // Sliding Session: Invalidate the old refresh token immediately.
    await this.redisService.del(sessionKey);

    // Fetch user to generate new tokens
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      // This is a critical and unexpected situation. A valid refresh token exists for a user
      // that is no longer in the database. This could happen if a user was deleted but their
      // sessions were not properly invalidated.
      this.logger.error(
        { userId, jti },
        this.i18nService.translate('User_Not_Found_With_Valid_Token'),
      );
      throw new BaseRpcException(
        this.i18nService.translate('User_not_found'),
        ErrorCodes.UNAUTHORIZED,
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
      // Store both tokens' JTIs in Redis for whitelisting
      const accessExpiresInSeconds = ms(accessExpiresIn) / 1000;
      const refreshExpiresInSeconds = ms(refreshExpiresIn) / 1000;
      await Promise.all([
        this.redisService.set(
          getAccessSessionKey(accessJti),
          userId,
          accessExpiresInSeconds,
        ),
        this.redisService.set(
          getRefreshSessionKey(refreshJti),
          userId,
          refreshExpiresInSeconds,
        ),
      ]);

      return [accessToken, refreshToken];
    } catch {
      // If storing the session in Redis fails, we should not issue the token.
      // This prevents issuing a token that can never be validated.
      throw new BaseRpcException(
        this.i18nService.translate('Login_Session_Store_Failed'),
        ErrorCodes.UNEXPECTED_ERROR,
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
