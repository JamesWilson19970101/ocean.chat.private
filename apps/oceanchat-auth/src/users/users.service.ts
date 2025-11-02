import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthProvider, User } from '@ocean.chat/models';
import { NATS_CLIENT_INJECTION_TOKEN } from '@ocean.chat/nats-opentelemetry-tracing';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';

@Injectable()
export class UsersService {
  constructor(
    @Inject(NATS_CLIENT_INJECTION_TOKEN)
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
          catchError((err) => {
            const message = this.i18nService.translate('SERVICE_ERROR', {
              method: 'user.query.byUsername',
            });
            // Wrap the original error in a business-specific exception
            return throwError(
              () =>
                new BaseRpcException(message, ErrorCodes.SERVICE_ERROR, {
                  cause: err,
                }),
            );
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
          catchError((err) => {
            const message = this.i18nService.translate('SERVICE_ERROR', {
              method: 'user.query.profile',
            });
            return throwError(
              () =>
                new BaseRpcException(message, ErrorCodes.SERVICE_ERROR, {
                  cause: err,
                }),
            );
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
          catchError((err) => {
            const message = this.i18nService.translate('SERVICE_ERROR', {
              method: 'user.validate.password',
            });
            return throwError(
              () =>
                new BaseRpcException(message, ErrorCodes.SERVICE_ERROR, {
                  cause: err,
                }),
            );
          }),
        ),
    );
  }
}
