import { Controller, Get, HttpStatus, Inject, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  BaseException,
  ErrorCodes,
  ErrorResponseDto,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import { Request } from 'express';
import { catchError, firstValueFrom, map, throwError, timeout } from 'rxjs';

@Controller('users')
export class UsersController {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Gets the profile of the currently authenticated user.
   * The user's basic info (id, username) is available from the JWT payload (req.user).
   * For a more detailed profile, we query the user microservice.
   */
  @Get('me')
  async getMyProfile(@Req() req: Request) {
    // req.user is populated by JwtAuthGuard from the token payload
    const { sub: userId } = req.user as { sub: string };

    // Call the user service to get the full, safe-to-expose profile
    return firstValueFrom(
      this.userClient
        .send<Partial<User> | null>('user.query.profile', { userId })
        .pipe(
          map((profile) => {
            if (!profile) {
              const message = this.i18nService.translate('USER_NOT_FOUND');
              const errorCode = ErrorCodes.USER_NOT_FOUND;
              throw new BaseException(message, HttpStatus.NOT_FOUND, errorCode);
            }
            return profile;
          }),
          timeout(5000),
          catchError((err: ErrorResponseDto) => {
            if (err && 'errorCode' in err && 'message' in err) {
              return throwError(
                () =>
                  new BaseException(
                    err.message,
                    HttpStatus.NOT_FOUND,
                    err.errorCode,
                    { cause: err },
                  ),
              );
            }

            return throwError(
              () =>
                new BaseException(
                  this.i18nService.translate('USER_NOT_FOUND'),
                  HttpStatus.NOT_FOUND,
                  ErrorCodes.USER_NOT_FOUND,
                  {
                    cause: err,
                  },
                ),
            );
          }),
        ),
    );
  }
}
