import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CircuitBreakerService } from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import { SyncMessagesDto, SyncMessagesResponse } from '@ocean.chat/types';
import { Request, Response } from 'express';
import { firstValueFrom, timeout } from 'rxjs';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorCodes, InfrastructureException, isErrorResponseDto } from '@ocean.chat/common-exceptions';

@Controller('messages')
export class QueryController {
  constructor(
    @Inject('QUERY_SERVICE') private readonly queryClient: ClientProxy,
    private readonly i18nService: I18nService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /**
   * HTTP Sync endpoint for clients to pull incremental message history.
   * This is part of the Push-Pull Hybrid strategy.
   */
  @Get('sync')
  async syncMessages(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() userId: string,
    @Query() syncDto: SyncMessagesDto,
  ) {
    return this.circuitBreakerService.fire('queryClient', async () => {
      try {
        const payload = { ...syncDto, userId };

        const response: SyncMessagesResponse = await firstValueFrom(
          this.queryClient.send({ cmd: 'sync_messages' }, payload).pipe(timeout(3000)),
        );

        if (isErrorResponseDto(response)) {
          return res.status(response.statusCode).json(response);
        }

        return res.status(200).json(response);
      } catch (error) {
        throw new InfrastructureException(
          this.i18nService.translate('SERVICE_ERROR'),
          ErrorCodes.SERVICE_ERROR,
          503,
          false,
          { cause: error },
        );
      }
    });
  }
}
