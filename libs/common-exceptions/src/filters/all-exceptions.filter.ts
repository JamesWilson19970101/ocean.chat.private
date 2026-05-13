import { ArgumentsHost, Catch, ExceptionFilter, Inject } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';

import { SERVICE_INSTANCE_ID, SERVICE_NAME } from '../common-exceptions.module';
import { BaseAppExceptionFilter } from './base-exception.filter';

/**
 * Intercept errors in HTTP/RPC/WS requests.
 * It standardizes error responses and ensures consistent logging.
 * Decouples Exception Nature (Domain vs Infrastructure) from Transport Protocol.
 */
@Catch()
export class AllExceptionsFilter
  extends BaseAppExceptionFilter
  implements ExceptionFilter
{
  constructor(
    @Inject(SERVICE_NAME) serviceName: string,
    @Inject(SERVICE_INSTANCE_ID) serviceInstanceId: string,
    @InjectPinoLogger('all.exceptions.filter') logger: PinoLogger,
    i18nService: I18nService,
  ) {
    super(serviceName, serviceInstanceId, logger, i18nService);
  }

  /**
   * Catches all unhandled exceptions and processes them based on the execution context (HTTP, RPC, WebSocket).
   * @param exception the caught exception
   * @param host the arguments host, which provides access to the execution context
   */
  catch(exception: unknown, host: ArgumentsHost): any {
    const contextType = host.getType();

    if (contextType === 'http') {
      this.handleHttpException(exception, host);
    } else if (contextType === 'rpc') {
      return this.handleRpcException(exception, host);
    } else {
      this.logger.error(
        { err: exception, contextType: String(contextType) },
        this.i18nService.translate('UNKNOWN_EXECUTION_CONTEXT_TYPE', {
          defaultValue: `Unsupported Execution Context Type in AllExceptionsFilter: ${String(contextType)}. Use dedicated filters (e.g., MonkeyWsExceptionFilter) for WebSockets.`,
        }),
      );
    }
  }

  private handleHttpException(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponseDto = this.createErrorResponse(exception, request.url);
    this.logException(exception, errorResponseDto, {
      method: request.method,
      url: request.url,
      query: request.query,
      headers: request.headers,
    });

    const clientResponse = {
      statusCode: errorResponseDto.statusCode,
      message: errorResponseDto.message,
      path: errorResponseDto.path,
      errorCode: errorResponseDto.errorCode,
    };

    response.status(errorResponseDto.statusCode).json(clientResponse);
  }

  private handleRpcException(
    exception: unknown,
    host: ArgumentsHost,
  ): Observable<never> {
    const ctx = host.switchToRpc();
    const errorResponseDto = this.createErrorResponse(exception);

    this.logException(exception, errorResponseDto, { rpcData: ctx.getData() });

    // RPC clients expect the payload, so we throw the raw response DTO.
    if (typeof errorResponseDto.message !== 'string') {
      errorResponseDto.message = JSON.stringify(errorResponseDto.message);
    }
    return throwError(() => errorResponseDto);
  }
}
