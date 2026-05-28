import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  DomainException,
  ErrorCodes,
  InfrastructureException,
  isAppException,
  isErrorResponseDto,
} from '@ocean.chat/common-exceptions';
import { CircuitBreakerService } from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import { AuthenticatedUser } from '@ocean.chat/types';
import { catchError, firstValueFrom, map, throwError, timeout } from 'rxjs';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Gets the profile of the currently authenticated user.
   * The user's basic info (id, username) is available from the JWT payload (req.user).
   * For a more detailed profile, we query the user microservice.
   */
  @Get('me')
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    // req.user is populated by JwtAuthGuard from the token payload
    const { _id: userId } = user;

    // Call the user service to get the full, safe-to-expose profile
    return this.circuitBreakerService.fire(
      'users.me',
      () =>
        firstValueFrom(
          this.userClient
            .send<Partial<User> | null>('user.query.profile', { userId })
            .pipe(
              timeout(9000),
              map((profile) => {
                if (!profile) {
                  const message = this.i18nService.translate('USER_NOT_FOUND');
                  const errorCode = ErrorCodes.USER_NOT_FOUND;
                  throw new DomainException(
                    message,
                    errorCode,
                    HttpStatus.NOT_FOUND,
                  );
                }
                return profile;
              }),
              catchError((err: unknown) => {
                // If it's the BaseException (404) we just threw in the map, just throw it out directly without changing the status code.
                if (isAppException(err)) {
                  return throwError(() => err);
                }
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
                      this.i18nService.translate('INTERNAL_SERVER_ERROR'),
                      ErrorCodes.UNEXPECTED_ERROR,
                      HttpStatus.INTERNAL_SERVER_ERROR,
                      false,
                      { cause: err as any },
                    ),
                );
              }),
            ),
        ),
      { timeout: 10000 },
    );
  }

  /**
   * Fetches an optimized list of all users containing only their _id and username.
   * Highly performant endpoint intended for dropdowns, auto-completes, etc.
   */
  @Get('all')
  async getAllUsernames() {
    return this.circuitBreakerService.fire(
      'users.allUsernames',
      () =>
        firstValueFrom(
          this.userClient
            .send<
              { _id: string; username: string }[]
            >('user.query.allUsernames', {})
            .pipe(
              timeout(5000),
              catchError((err: unknown) => {
                if (isAppException(err)) {
                  return throwError(() => err);
                }
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
                      this.i18nService.translate('INTERNAL_SERVER_ERROR'),
                      ErrorCodes.UNEXPECTED_ERROR,
                      HttpStatus.INTERNAL_SERVER_ERROR,
                      false,
                      { cause: err as any },
                    ),
                );
              }),
            ),
        ),
      { timeout: 10000 },
    );
  }
}
