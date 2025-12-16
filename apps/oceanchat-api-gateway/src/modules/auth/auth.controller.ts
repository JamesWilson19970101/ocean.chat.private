import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  BaseException,
  ErrorCodes,
  isErrorResponseDto,
} from '@ocean.chat/common-exceptions';
import { SkipAuth } from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';

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
  @HttpCode(HttpStatus.OK)
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
          catchError((err: unknown) => {
            // Check if the error from the microservice is a structured ErrorResponseDto
            if (isErrorResponseDto(err)) {
              // Propagate the specific error code and message from the auth-service
              return throwError(
                () =>
                  new BaseException(
                    err.message,
                    err.statusCode,
                    err.errorCode,
                    { cause: err },
                  ),
              );
            }
            // Fallback for unexpected or unstructured errors
            const message = this.i18nService.translate('INTERNAL_SERVER_ERROR');
            return throwError(
              () =>
                new BaseException(
                  message,
                  HttpStatus.INTERNAL_SERVER_ERROR,
                  ErrorCodes.UNEXPECTED_ERROR,
                  { cause: err as any },
                ),
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
        catchError((err: unknown) => {
          if (isErrorResponseDto(err)) {
            return throwError(
              () =>
                new BaseException(err.message, err.statusCode, err.errorCode, {
                  cause: err,
                }),
            );
          }
          return throwError(
            () =>
              new BaseException(
                this.i18nService.translate('REGISTRATION_FAILED'),
                HttpStatus.INTERNAL_SERVER_ERROR,
                ErrorCodes.CREATION_ERROR,
                { cause: err as any },
              ),
          );
        }),
      ),
    );
  }
}
