import { Body, Controller, HttpStatus, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BaseException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';

import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Handles user login requests.
   */
  @SkipAuth()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<{ accessToken: string; user: Pick<User, '_id' | 'username'> }> {
    return firstValueFrom(
      this.authClient
        .send<{
          accessToken: string;
          refreshToken: string;
          user: Pick<User, '_id' | 'username'>;
        }>('auth.login', loginDto)
        .pipe(
          timeout(5000),
          catchError((err) => {
            // The error from a microservice is an RpcException.
            // We convert it to a BaseException (which extends HttpException)
            // to ensure it's handled correctly by the global AllExceptionsFilter.
            const message = this.i18nService.translate('UNAUTHORIZED');
            const errorCode = ErrorCodes.UNAUTHORIZED;
            return throwError(
              () =>
                new BaseException(message, HttpStatus.UNAUTHORIZED, errorCode, {
                  cause: err,
                }),
            );
          }),
        ),
    );
  }

  /**
   * Handles user registration requests.
   */
  @SkipAuth()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<Partial<User>> {
    // Registration logic is handled by the user microservice
    return firstValueFrom<Partial<User>>(
      this.userClient.send<Partial<User>>('user.create', registerDto).pipe(
        timeout(5000),
        catchError((err) => {
          const message = this.i18nService.translate('REGISTRATION_FAILED');
          const errorCode = ErrorCodes.CREATION_ERROR;
          // Use HttpStatus.BAD_REQUEST for validation-like errors during registration.
          return throwError(
            () =>
              new BaseException(message, HttpStatus.BAD_REQUEST, errorCode, {
                cause: err,
              }),
          );
        }),
      ),
    );
  }
}
