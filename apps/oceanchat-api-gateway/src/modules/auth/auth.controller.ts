import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  DomainException,
  ErrorCodes,
  InfrastructureException,
  isErrorResponseDto,
} from '@ocean.chat/common-exceptions';
import {
  CircuitBreakerService,
  Idempotency,
  SkipAuth,
} from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import {
  CreateUserDto,
  LoginDto,
  RefreshTokenDto,
  RefreshTokenResult,
} from '@ocean.chat/types';
import { Request, Response } from 'express';
import * as ms from 'ms';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly i18nService: I18nService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /**
   * Handles user login requests.
   * Retrieves tokens from backend and sets the Refresh Token as an HttpOnly cookie.
   */
  @SkipAuth()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: Pick<User, '_id' | 'username'> }> {
    const result = await this.circuitBreakerService.fire(
      'auth.login',
      () =>
        firstValueFrom(
          this.authClient
            .send<{
              accessToken: string;
              refreshToken: string;
              user: Pick<User, '_id' | 'username'>;
            }>('auth.login', loginDto)
            .pipe(
              timeout(5000),
              catchError((err: unknown) => {
                if (isErrorResponseDto(err)) {
                  return throwError(
                    () =>
                      new DomainException(
                        err.message,
                        err.errorCode,
                        err.statusCode,
                        { cause: err },
                      ),
                  );
                }
                const message = this.i18nService.translate(
                  'INTERNAL_SERVER_ERROR',
                );
                return throwError(
                  () =>
                    new InfrastructureException(
                      message,
                      ErrorCodes.UNEXPECTED_ERROR,
                      HttpStatus.INTERNAL_SERVER_ERROR,
                      false,
                      { cause: err },
                    ),
                );
              }),
            ),
        ),
      { timeout: 6000 },
    );

    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) as `${number}${ms.Unit}`;

    // Set Refresh Token as a secure HttpOnly cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/', // Allow cookie across the domain so Next.js proxy.ts and API proxy can see it
      maxAge: ms(refreshExpiresIn),
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * Handles user registration requests.
   */
  @SkipAuth()
  @Idempotency({ cacheTtl: 60 })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() registerDto: CreateUserDto): Promise<Partial<User>> {
    return this.circuitBreakerService.fire(
      'user.create',
      () =>
        firstValueFrom<Partial<User>>(
          this.userClient.send<Partial<User>>('user.create', registerDto).pipe(
            timeout(5000),
            catchError((err: unknown) => {
              if (isErrorResponseDto(err)) {
                return throwError(
                  () =>
                    new DomainException(
                      err.message,
                      err.errorCode,
                      err.statusCode,
                      { cause: err },
                    ),
                );
              }
              return throwError(
                () =>
                  new InfrastructureException(
                    this.i18nService.translate('REGISTRATION_FAILED'),
                    ErrorCodes.CREATION_ERROR,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    false,
                    { cause: err },
                  ),
              );
            }),
          ),
        ),
      { timeout: 6000 },
    );
  }

  /**
   * Handles token refresh requests.
   * Reads Refresh Token from HttpOnly cookie (or body fallback), and rotates it.
   */
  @SkipAuth()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    // Parse cookies manually to remain independent of cookie-parser middleware
    const cookies =
      req.headers.cookie?.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.split('=').map((c) => c.trim());
        acc[key] = value;
        return acc;
      }, {}) || {};

    const refreshToken =
      cookies['refresh_token'] || refreshTokenDto?.refreshToken;

    if (!refreshToken) {
      throw new DomainException(
        this.i18nService.translate('UNAUTHORIZED'),
        ErrorCodes.UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const result = await this.circuitBreakerService.fire(
      'auth.token.refresh',
      () =>
        firstValueFrom(
          this.authClient
            .send<RefreshTokenResult>('auth.token.refresh', {
              refreshToken,
            })
            .pipe(
              timeout(5000),
              catchError((err: unknown) => {
                if (isErrorResponseDto(err)) {
                  return throwError(
                    () =>
                      new DomainException(
                        err.message,
                        err.errorCode,
                        err.statusCode,
                        { cause: err },
                      ),
                  );
                }
                return throwError(
                  () =>
                    new InfrastructureException(
                      this.i18nService.translate('REFRESHTOKEN_ERROR'),
                      ErrorCodes.TOKEN_REFRESH_ERROR,
                      HttpStatus.INTERNAL_SERVER_ERROR,
                      false,
                      { cause: err },
                    ),
                );
              }),
            ),
        ),
      { timeout: 6000 },
    );

    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) as `${number}${ms.Unit}`;

    // Rotate the RT: Set the newly generated Refresh Token in the cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ms(refreshExpiresIn),
    });

    return { accessToken: result.accessToken };
  }

  /**
   * Handles user logout requests.
   * Clears the HttpOnly refresh token cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: { sub: string; deviceId: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { sub: userId, deviceId } = user;

    await this.circuitBreakerService.fire('auth.logout', () =>
      firstValueFrom<number>(
        this.authClient.send<number>('auth.logout', { userId, deviceId }).pipe(
          timeout(5000),
          catchError((err: unknown) => {
            if (isErrorResponseDto(err)) {
              return throwError(
                () =>
                  new DomainException(
                    err.message,
                    err.errorCode,
                    err.statusCode,
                    { cause: err },
                  ),
              );
            }
            const message = this.i18nService.translate('INTERNAL_SERVER_ERROR');
            return throwError(
              () =>
                new InfrastructureException(
                  message,
                  ErrorCodes.UNEXPECTED_ERROR,
                  HttpStatus.INTERNAL_SERVER_ERROR,
                  false,
                  { cause: err },
                ),
            );
          }),
        ),
      ),
    );

    // Clear the refresh token cookie
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
}
