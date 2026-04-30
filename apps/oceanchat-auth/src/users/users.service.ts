import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  BaseRpcException,
  ErrorCodes,
  ErrorResponseDto,
  isErrorResponseDto,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthProvider, User } from '@ocean.chat/models';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  catchError,
  firstValueFrom,
  Observable,
  throwError,
  timeout,
} from 'rxjs';

@Injectable()
export class UsersService {
  constructor(
    @Inject('USER_SERVICE')
    private readonly userClient: ClientProxy,
    // Inject I18nService for user-friendly error messages
    private readonly i18nService: I18nService,
    // Inject PinoLogger for structured logging
    @InjectPinoLogger('oceanchat.auth.users.service')
    private readonly logger: PinoLogger,
  ) {}

  async findOneByUsernameAndProvider(
    username: string,
    provider: AuthProvider,
  ): Promise<User | null> {
    // Delegate user lookup to the user-service
    return firstValueFrom(
      this.userClient
        .send<User | null>('user.query.byUsername', { username, provider })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            return this.handleRpcError(err);
          }),
        ),
    );
  }

  findOneById(id: string): Promise<Partial<User> | null> {
    // Delegate user lookup to the user-service
    return firstValueFrom(
      this.userClient
        .send<Partial<User> | null>('user.query.profile', { userId: id })
        .pipe(
          timeout(5000),
          catchError((err: ErrorResponseDto | Error) => {
            return this.handleRpcError(err);
          }),
        ),
    );
  }

  async validatePassword(
    username: string,
    password: string,
  ): Promise<Partial<User> | null> {
    return firstValueFrom(
      this.userClient
        .send<Partial<User> | null>('user.validate.password', {
          username,
          password,
        })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => {
            return this.handleRpcError(err);
          }),
        ),
    );
  }

  /**
   * Centralized error handling for RPC calls.
   * Ensures that status codes are propagated correctly and timeouts are handled.
   */
  private handleRpcError(err: unknown): Observable<never> {
    // Handle Structured Errors from Downstream (Propagate Status Code)
    if (isErrorResponseDto(err)) {
      return throwError(
        () =>
          new BaseRpcException(err.message, err.statusCode, err.errorCode, {
            cause: err as ErrorResponseDto,
          }),
      );
    }

    // Handle Unexpected Errors (500 Internal Server Error)
    const message = this.i18nService.translate('INTERNAL_SERVER_ERROR');
    return throwError(
      () =>
        new BaseRpcException(
          message,
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCodes.UNEXPECTED_ERROR,
          {
            cause: err as any,
          },
        ),
    );
  }
}
