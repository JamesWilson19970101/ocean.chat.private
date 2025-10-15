import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
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
import { BaseHttpException } from '../exceptions/http.exception';
import { BaseRpcException } from '../exceptions/rpc.exception';
import { BaseWsException } from '../exceptions/ws.exception';

export type CustomException = {
  message: string;
  errorCode: number;
  details?: any;
  error: {
    message: string;
    errorCode: number;
    details?: any;
    status?: number;
  };
  status?: number;
};

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
  catch(exception: unknown, host: ArgumentsHost): any {
    // Log the exception details for debugging and monitoring
    this.logger.error(
      { err: exception },
      'An exception was caught by AllExceptionsFilter...',
    );
    const contextType = host.getType();

    // Handle the exception based on the context type
    if (contextType === 'http') {
      this.handleHttpException(exception as BaseHttpException, host);
    } else if (contextType === 'rpc') {
      return this.handleRpcException(exception as BaseRpcException, host);
    } else if (contextType === 'ws') {
      this.handleWsException(exception as BaseWsException, host);
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
  private handleHttpException(
    exception: BaseHttpException,
    host: ArgumentsHost,
  ): void {
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

  private handleRpcException(
    exception: BaseRpcException,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    host: ArgumentsHost,
  ): any {
    const errorResponse = this.createErrorResponse(exception);
    if (typeof errorResponse.message !== 'string') {
      errorResponse.message = JSON.stringify(errorResponse.message);
    }
    return new RpcException(errorResponse);
  }

  /**
   * process WebSocket exceptions and emit a standardized error response to the client
   * @param exception exception
   * @param host arguments host
   */
  private handleWsException(
    exception: BaseWsException,
    host: ArgumentsHost,
  ): void {
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
    exception: BaseHttpException | BaseRpcException | WsException | Error,
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
    } else if (exception instanceof BaseHttpException) {
      // process NestJS built-in HTTP exceptions
      // eg. 400, 401, 403, 404, 500, etc.
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const responseMessage = (response as { message: string | string[] })
          .message;
        if (exception?.errorCode) {
          errorCode = exception?.errorCode;
        }
        message = {
          message: Array.isArray(responseMessage)
            ? responseMessage.join(', ')
            : responseMessage,
          errorCode: errorCode, // Default error code for standard HttpExceptions
        };
      }
    } else if (exception instanceof BaseRpcException) {
      if (exception?.errorCode) {
        errorCode = exception?.errorCode;
      }

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
      message,
      errorCode,
      details,
      statusCode,
      serviceName: this.serviceName,
      path,
      timestamp: new Date().toISOString(),
    });
  }
}
