import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  DomainException,
  ErrorCodes,
  InfrastructureException,
  isErrorResponseDto,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { IRoleDataSource } from '@ocean.chat/types';
import {
  catchError,
  firstValueFrom,
  Observable,
  throwError,
  timeout,
} from 'rxjs';

@Injectable()
export class RpcRoleDataSource implements IRoleDataSource {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly i18nService: I18nService,
  ) {}

  async getUserGlobalRoles(userId: string): Promise<string[]> {
    return firstValueFrom(
      this.userClient
        .send<string[]>('auth.roles.getUserGlobalRoles', { userId })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => this.handleRpcError(err)),
        ),
    );
  }

  async getRolesForPermission(permissionId: string): Promise<string[]> {
    return firstValueFrom(
      this.userClient
        .send<string[]>('auth.roles.getRolesForPermission', { permissionId })
        .pipe(
          timeout(5000),
          catchError((err: unknown) => this.handleRpcError(err)),
        ),
    );
  }

  private handleRpcError(err: unknown): Observable<never> {
    if (isErrorResponseDto(err)) {
      return throwError(
        () =>
          new DomainException(err.message, err.errorCode, err.statusCode, {
            cause: err,
          }),
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
          {
            cause: err,
          },
        ),
    );
  }
}
