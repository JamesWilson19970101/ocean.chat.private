import { Body, Controller, HttpStatus, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  PermissionCheckerService,
  PermissionId,
} from '@ocean.chat/authorization';
import {
  DomainException,
  ErrorCodes,
  InfrastructureException,
  isAppException,
  isErrorResponseDto,
} from '@ocean.chat/common-exceptions';
import { CircuitBreakerService } from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import { CreateRoomDto } from '@ocean.chat/models';
import {
  CreateRoomRpcRequest,
  CreateRoomRpcResponse,
  GroupType,
  IJwtPayload,
} from '@ocean.chat/types';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('groups')
export class GroupController {
  constructor(
    @Inject('GROUP_SERVICE') private readonly groupClient: ClientProxy,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly i18nService: I18nService,
    private readonly permissionChecker: PermissionCheckerService,
  ) {}

  @Post('create')
  async createGroup(
    @CurrentUser() user: IJwtPayload,
    @Body() createRoomDto: CreateRoomDto,
  ) {
    const userId = user.sub;

    // Check permission based on the requested group type
    const permissionRequired =
      createRoomDto.type === GroupType.PRIVATE_GROUP
        ? PermissionId.CREATE_P
        : PermissionId.CREATE_D;

    const hasPermission = await this.permissionChecker.hasPermission(
      userId,
      permissionRequired,
    );

    if (!hasPermission) {
      throw new DomainException(
        this.i18nService.translate('PERMISSION_GUARD_ACCESS_DENIED'),
        ErrorCodes.UNAUTHORIZED,
        HttpStatus.FORBIDDEN,
      );
    }

    const payload: CreateRoomRpcRequest = {
      type: createRoomDto.type,
      name: createRoomDto.name,
      members: createRoomDto.members,
      userId: userId,
    };

    return this.circuitBreakerService.fire(
      'groups.create',
      () =>
        firstValueFrom(
          this.groupClient
            .send<CreateRoomRpcResponse>('group.cmd.create', payload)
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
      { timeout: 6000 },
    );
  }
}
