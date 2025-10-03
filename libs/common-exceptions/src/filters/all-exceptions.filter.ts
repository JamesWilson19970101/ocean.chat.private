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
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WebSocket } from 'ws';

import { SERVICE_NAME } from '../common-exceptions.module';
import { ErrorCodes } from '../constants/error-codes.enum';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { BaseException } from '../exceptions/base.exception';

/**
 * global exception filter that catches all unhandled exceptions across different contexts (HTTP, RPC, WebSocket).
 * It standardizes error responses and ensures consistent logging.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(SERVICE_NAME) private readonly serviceName: string,
    @InjectPinoLogger('ocean.chat.all.exceptions.filter')
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Catches all unhandled exceptions and processes them based on the execution context (HTTP, RPC, WebSocket).
   * @param exception the caught exception
   * @param host the arguments host, which provides access to the execution context
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    // Log the exception details for debugging and monitoring
    this.logger.error(
      'An exception was caught by AllExceptionsFilter:',
      exception,
    );

    const contextType = host.getType();

    // Handle the exception based on the context type
    if (contextType === 'http') {
      this.handleHttpException(exception, host);
    } else if (contextType === 'rpc') {
      this.handleRpcException(exception, host);
    } else if (contextType === 'ws') {
      this.handleWsException(exception, host);
    } else {
      // Unknown context type, log a warning
      this.logger.error(
        `Unknown execution context type: ${String(contextType)}`,
      );
    }
  }

  /**
   * process HTTP exceptions and send a standardized error response
   * @param exception exception
   * @param host arguments host
   */
  private handleHttpException(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const responseBody = this.createErrorResponse(exception, request.url);

    response.status(responseBody.statusCode).json(responseBody);
  }

  /**
   * process RPC exceptions and return a standardized error response
   * @param exception exception
   * @param host arguments host
   * @returns RpcException
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleRpcException(exception: unknown, host: ArgumentsHost): any {
    const errorResponse = this.createErrorResponse(exception);
    return new RpcException(errorResponse);
  }

  /**
   * process WebSocket exceptions and emit a standardized error response to the client
   * @param exception exception
   * @param host arguments host
   */
  private handleWsException(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToWs();
    const client = ctx.getClient<WebSocket>();
    const errorResponse = this.createErrorResponse(exception);

    // For 'ws' library, use client.send() to transmit data.
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event: 'exception', data: errorResponse }));
    }
  }

  /**
   * create a standardized error response DTO based on the exception type
   * @param exception exception
   * @param path optional request path
   * @returns standardized error response DTO
   */
  private createErrorResponse(
    exception: unknown,
    path?: string,
  ): ErrorResponseDto {
    // Default values for an unexpected error
    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal Server Error';
    let errorCode: number = ErrorCodes.UNEXPECTED_ERROR;
    let details: any;

    if (exception instanceof BaseException) {
      // process custom base exceptions
      statusCode = exception.getStatus();
      message = exception.getResponse();
      errorCode = exception.getErrorCode();
      details = exception.getDetails();
    } else if (exception instanceof HttpException) {
      // process NestJS built-in HTTP exceptions
      // eg. 400, 401, 403, 404, 500, etc.
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === 'string'
          ? response
          : typeof response === 'object' &&
              response !== null &&
              'message' in response
            ? ((response as Record<string, any> & { message?: string })
                .message ?? 'Unknown error')
            : response;
    } else if (exception instanceof RpcException) {
      // process RPC exceptions between microservices
      const rpcError = exception.getError();
      message =
        typeof rpcError === 'string' ? rpcError : JSON.stringify(rpcError);
    } else if (exception instanceof WsException) {
      // process WebSocket exceptions
      const wsError = exception.getError();
      message = typeof wsError === 'string' ? wsError : JSON.stringify(wsError);
    } else if (exception instanceof Error) {
      // process native JS errors
      // eg. ReferenceError, TypeError, SyntaxError, etc.
      message = exception.message;
    }

    return new ErrorResponseDto({
      statusCode,
      message,
      errorCode,
      serviceName: this.serviceName,
      path,
      timestamp: new Date().toISOString(),
      details,
    });
  }
}
