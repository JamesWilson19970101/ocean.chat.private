import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { WsException } from '@nestjs/websockets';
import { I18nService } from '@ocean.chat/i18n';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';
import { WebSocket } from 'ws';

import { SERVICE_INSTANCE_ID, SERVICE_NAME } from '../common-exceptions.module';
import { ErrorCodes } from '../constants/error-codes.enum';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { isAppException } from '../utils/is-app-exception.util';

/**
 * Intercept errors in HTTP/RPC/WS requests.
 * It standardizes error responses and ensures consistent logging.
 * Decouples Exception Nature (Domain vs Infrastructure) from Transport Protocol.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(SERVICE_NAME) private readonly serviceName: string,
    @Inject(SERVICE_INSTANCE_ID)
    private readonly serviceInstanceId: string,
    @InjectPinoLogger('all.exceptions.filter')
    private readonly logger: PinoLogger,
    private readonly i18nService: I18nService,
  ) {}

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
    } else if (contextType === 'ws') {
      this.handleWsException(exception, host);
    } else {
      this.logger.error(
        { err: exception, contextType: String(contextType) },
        this.i18nService.translate('UNKNOWN_EXECUTION_CONTEXT_TYPE', {
          defaultValue: `Unknown Execution Context Type: ${String(contextType)}`,
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

  private handleWsException(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToWs();
    const client = ctx.getClient<WebSocket>();
    const errorResponseDto = this.createErrorResponse(exception);

    this.logException(exception, errorResponseDto, { wsData: ctx.getData() });

    if (client.readyState === WebSocket.OPEN) {
      const clientResponse = { ...errorResponseDto };
      delete clientResponse.details;
      client.send(JSON.stringify({ event: 'exception', data: clientResponse }));
    }
  }

  /**
   * Logs the exception based on its Nature (DOMAIN vs INFRASTRUCTURE).
   * - DOMAIN: logs at WARN/INFO level without stack traces.
   * - INFRASTRUCTURE: logs at ERROR level with full stack trace.
   */
  private logException(
    exception: unknown,
    errorResponseDto: ErrorResponseDto,
    contextData: Record<string, unknown>,
  ): void {
    const isDomain =
      isAppException(exception) && exception.exceptionType === 'DOMAIN';

    if (isDomain) {
      this.logger.warn(
        {
          response: errorResponseDto,
          context: contextData,
          errMessage: exception.message || 'Unknown domain exception',
        },
        'Domain Exception caught by AllExceptionsFilter',
      );
    } else {
      this.logger.error(
        {
          err: exception, // Full error including stack trace
          response: errorResponseDto,
          context: contextData,
        },
        'Infrastructure Exception caught by AllExceptionsFilter',
      );
    }
  }

  /**
   * creates a standardized error response DTO based on the exception.
   * If it's an Infrastructure Exception, it sanitizes the response for security.
   */
  public createErrorResponse(
    exception: unknown,
    path?: string,
  ): ErrorResponseDto {
    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: number = ErrorCodes.UNEXPECTED_ERROR;
    let message = this.i18nService.translate('INTERNAL_SERVER_ERROR', {
      defaultValue: 'Internal Server Error',
    });
    let details: Record<string, unknown> | undefined;

    if (isAppException(exception)) {
      statusCode = exception.getStatusCode();
      errorCode = exception.getErrorCode();
      details = exception.getDetails();

      // For Domain exceptions, we trust the message and code.
      if (exception.exceptionType === 'DOMAIN') {
        message = exception.message || message;
      } else {
        // For Infrastructure exceptions, we sanitize the client-facing message to prevent data leaks.
        message = this.i18nService.translate('SYSTEM_UNAVAILABLE', {
          defaultValue: 'Service Unavailable',
        });
        // We override to 5xx to ensure it's treated as a server fault.
        statusCode =
          statusCode < 500 ? HttpStatus.INTERNAL_SERVER_ERROR : statusCode;
        errorCode = ErrorCodes.SERVICE_ERROR;
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      errorCode = statusCode;
      const response = exception.getResponse();

      // Parse NestJS built-in HTTP exceptions (often ValidationPipe errors)
      if (typeof response === 'string') {
        message = response;
      } else if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const responseMessage = (response as { message: string | string[] })
          .message;
        message = Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : responseMessage;
      } else if (typeof response === 'object' && response !== null) {
        message = JSON.stringify(response);
      }
    } else if (exception instanceof RpcException) {
      const rpcError = exception.getError();
      message =
        typeof rpcError === 'string' ? rpcError : JSON.stringify(rpcError);
    } else if (exception instanceof WsException) {
      const wsError = exception.getError();
      message = typeof wsError === 'string' ? wsError : JSON.stringify(wsError);
    } else if (exception instanceof Error) {
      // Unhandled native errors are treated as infrastructure failures (sanitized)
      message = this.i18nService.translate('SYSTEM_UNAVAILABLE', {
        defaultValue: 'Service Unavailable',
      });
      if (
        'statusCode' in exception &&
        typeof exception.statusCode === 'number'
      ) {
        statusCode = exception.statusCode;
      }
    } else {
      // Completely unknown error types
      message = this.i18nService.translate('SYSTEM_UNAVAILABLE', {
        defaultValue: 'Service Unavailable',
      });
    }

    return new ErrorResponseDto({
      message,
      errorCode,
      details,
      statusCode,
      serviceName: this.serviceName,
      serviceInstanceId: this.serviceInstanceId,
      path,
      timestamp: new Date().toISOString(),
    });
  }
}
