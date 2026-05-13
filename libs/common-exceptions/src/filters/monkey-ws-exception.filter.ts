import { ArgumentsHost, Catch, ExceptionFilter, Inject } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import {
  ExceptionAck,
  MonkeyCmd,
  MonkeyFlags,
  MonkeyService,
} from '@ocean.chat/monkey';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WebSocket } from 'ws';

import {
  SERVICE_INSTANCE_ID,
  SERVICE_NAME,
} from '../constants/common-exceptions.constants';
import { BaseAppExceptionFilter } from './base-exception.filter';

@Catch()
export class MonkeyWsExceptionFilter
  extends BaseAppExceptionFilter
  implements ExceptionFilter
{
  constructor(
    @Inject(SERVICE_NAME) serviceName: string,
    @Inject(SERVICE_INSTANCE_ID) serviceInstanceId: string,
    @InjectPinoLogger('monkey.ws.exceptions.filter') logger: PinoLogger,
    i18nService: I18nService,
    private readonly monkeyService: MonkeyService,
  ) {
    super(serviceName, serviceInstanceId, logger, i18nService);
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToWs();
    const client = ctx.getClient<WebSocket>();
    const data = ctx.getData<any>();

    const errorResponseDto = this.createErrorResponse(exception);

    this.logException(exception, errorResponseDto, { wsData: data });

    if (client.readyState === WebSocket.OPEN) {
      const exceptionAck: ExceptionAck = {
        errorCode: errorResponseDto.errorCode,
        message: errorResponseDto.message,
        timestamp: errorResponseDto.timestamp,
      };

      const payload = Buffer.from(ExceptionAck.encode(exceptionAck).finish());

      // Attempt to extract reqId from the context data
      // Assuming data is an object containing the un-framed header or a reqId property.
      // If reqId is missing, default to 0.
      let reqId = 0;
      if (data && typeof data === 'object') {
        const wsData = data as { header?: { reqId?: number }; reqId?: number };
        if (wsData.header && typeof wsData.header.reqId === 'number') {
          reqId = wsData.header.reqId;
        } else if (typeof wsData.reqId === 'number') {
          reqId = wsData.reqId;
        }
      }

      const framedBuffer = this.monkeyService.frame(
        {
          cmd: MonkeyCmd.EXCEPTION_ACK,
          flags: MonkeyFlags.NONE,
          reqId,
        },
        payload,
      );

      client.send(framedBuffer);
    }
  }
}
