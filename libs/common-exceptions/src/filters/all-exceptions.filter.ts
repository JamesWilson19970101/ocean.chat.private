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
import { BaseException } from '../exceptions/base.exception';
import { BaseRpcException } from '../exceptions/rpc.exception';
import { BaseWsException } from '../exceptions/ws.exception';

/**
 * global exception filter that catches all unhandled exceptions across different contexts (HTTP, RPC, WebSocket).
 * It standardizes error responses and ensures consistent logging.
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

    // Handle the exception based on the context type
    if (contextType === 'http') {
      this.handleHttpException(exception as HttpException, host);
    } else if (contextType === 'rpc') {
      return this.handleRpcException(exception as RpcException, host);
    } else if (contextType === 'ws') {
      this.handleWsException(exception as WsException, host);
    } else {
      // Unknown context type, log a warning
      this.logger.error(
        { err: exception, contextType: String(contextType) }, // Log the original exception and context type
        this.i18nService.translate('UNKNOWN_EXECUTION_CONTEXT_TYPE', {
          contextType: String(contextType),
        }),
      );
    }
  }

  /**
   * process HTTP exceptions and send a standardized error response
   * @param exception exception
   * @param host arguments host
   */
  private handleHttpException(
    exception: HttpException | Error,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const responseBody = this.createErrorResponse(exception, request.url);

    const logPayload = {
      err: exception, // The original exception object
      response: responseBody,
      request: {
        method: request.method,
        url: request.url,
        query: request.query,
        headers: request.headers,
      },
    };

    // Differentiated logging: WARN for 4xx, ERROR for 5xx
    if (responseBody.statusCode >= 500) {
      this.logger.error(logPayload, `Error: ${request.method} ${request.url}`);
    } else {
      this.logger.warn(logPayload, `Warning: ${request.method} ${request.url}`);
    }

    const clientResponse = {
      statusCode: responseBody.statusCode,
      message: responseBody.message,
      path: responseBody.path,
      errorCode: responseBody.errorCode,
    };

    response.status(responseBody.statusCode).json(clientResponse);
  }

  /**
   * process RPC exceptions and return a standardized error response
   * @param exception exception
   * @param host arguments host
   * @returns RpcException
   */

  private handleRpcException(
    exception: RpcException | Error,
    host: ArgumentsHost,
  ): Observable<never> {
    const ctx = host.switchToRpc();
    const errorResponse = this.createErrorResponse(exception);
    // RPC exceptions are logged as ERROR
    this.logger.error(
      {
        err: exception,
        response: errorResponse,
        rpcData: ctx.getData(),
      },
      this.i18nService.translate('RPC_ERROR_CAUGHT_BY_FILTER'),
    );
    if (typeof errorResponse.message !== 'string') {
      errorResponse.message = JSON.stringify(errorResponse.message);
    }
    // Previously, the `handleRpcException` method in `AllExceptionsFilter` would
    // return a new `RpcException(...)` object.

    // When this filter caught an error originating from an interceptor's RxJS
    // stream (like `NatsTraceInterceptor`'s `catchError`), returning a plain
    // object broke the observable chain.
    return throwError(() => errorResponse);
  }

  /**
   * process WebSocket exceptions and emit a standardized error response to the client
   * @param exception exception
   * @param host arguments host
   */
  private handleWsException(
    exception: WsException | Error,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToWs();
    const client = ctx.getClient<WebSocket>();
    const errorResponse = this.createErrorResponse(exception);
    // WS exceptions are logged as ERROR
    this.logger.error(
      {
        err: exception,
        response: errorResponse,
        wsData: ctx.getData(),
      },
      'WebSocket Error caught by AllExceptionsFilter',
    );
    // For 'ws' library, use client.send() to transmit data.
    if (client.readyState === WebSocket.OPEN) {
      const clientResponse = { ...errorResponse };
      delete clientResponse.details;
      client.send(JSON.stringify({ event: 'exception', data: clientResponse }));
    }
  }

  /**
   * create a standardized error response DTO based on the exception type
   * @param exception exception
   * @param path optional request path
   * @returns standardized error response DTO
   */
  public createErrorResponse(
    exception: HttpException | RpcException | WsException | Error,
    path?: string,
  ): ErrorResponseDto {
    // Default values for an unexpected error
    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = this.i18nService.translate('INTERNAL_SERVER_ERROR');
    let errorCode: number = ErrorCodes.UNEXPECTED_ERROR;
    let details: any;

    if (exception instanceof BaseException) {
      // process NestJS built-in HTTP exceptions
      // eg. 400, 401, 403, 404, 500, etc.
      statusCode = exception.getStatus();
      errorCode = exception.getErrorCode();
      details = exception.getDetails();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response // process the case of error returned by ValidationPipe
      ) {
        const responseMessage = (response as { message: string | string[] })
          .message;
        message = Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : responseMessage;
      } else if (typeof response === 'object' && response !== null) {
        message = JSON.stringify(response);
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      errorCode = statusCode;
      if (typeof response === 'string') {
        message = response;
      } else if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response // process the case of error returned by ValidationPipe
      ) {
        const responseMessage = (response as { message: string | string[] })
          .message;
        message = Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : responseMessage;
      } else if (typeof response === 'object' && response !== null) {
        message = JSON.stringify(response);
      }
    } else if (exception instanceof BaseRpcException) {
      message = exception.message;
      errorCode = exception.getErrorCode();
      details = exception.getDetails();
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    } else if (exception instanceof RpcException) {
      // process NestJS built-in RPC exceptions
      const rpcError = exception.getError();
      message =
        typeof rpcError === 'string' ? rpcError : JSON.stringify(rpcError);
      errorCode = ErrorCodes.UNEXPECTED_ERROR;
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    } else if (exception instanceof BaseWsException) {
      // process custom WebSocket exceptions
      message = exception.message;
      errorCode = exception.getErrorCode();
      details = exception.getDetails();
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    } else if (exception instanceof WsException) {
      // process NestJS built-in WebSocket exceptions
      const wsError = exception.getError();
      message = typeof wsError === 'string' ? wsError : JSON.stringify(wsError);
      errorCode = ErrorCodes.UNEXPECTED_ERROR;
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    } else {
      // Fallback for any other type of error, including native JS errors and non-Error objects.
      if (exception instanceof Error) {
        // Process native JS errors (e.g., ReferenceError, TypeError)
        message = exception.message;
      } else {
        // Handle cases where a non-Error object (e.g., a string or plain object) is thrown.
        // This ensures that no thrown value is ever lost.
        message = JSON.stringify(exception);
      }
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
