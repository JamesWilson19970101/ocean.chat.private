import { HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { WsException } from '@nestjs/websockets';
import { I18nService } from '@ocean.chat/i18n';
import { PinoLogger } from 'nestjs-pino';

import { ErrorCodes } from '../constants/error-codes.enum';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { isAppException } from '../utils/is-app-exception.util';

export abstract class BaseAppExceptionFilter {
  constructor(
    protected readonly serviceName: string,
    protected readonly serviceInstanceId: string,
    protected readonly logger: PinoLogger,
    protected readonly i18nService: I18nService,
  ) {}

  /**
   * Logs the exception based on its Nature (DOMAIN vs INFRASTRUCTURE).
   * - DOMAIN: logs at WARN/INFO level without stack traces.
   * - INFRASTRUCTURE: logs at ERROR level with full stack trace.
   */
  protected logException(
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
        'Domain Exception caught by AppExceptionFilter',
      );
    } else {
      this.logger.error(
        {
          err: exception, // Full error including stack trace
          response: errorResponseDto,
          context: contextData,
        },
        'Infrastructure Exception caught by AppExceptionFilter',
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
        // I override to 5xx to ensure it's treated as a server fault.
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
