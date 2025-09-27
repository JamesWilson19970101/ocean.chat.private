import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WebSocket } from 'ws';

import { BusinessException } from './exceptions/business.exception';

// Define the unified error response structure
interface ErrorResponse {
  code: number;
  message: string;
  path?: string;
  timestamp?: string;
  type: 'Business' | 'System';
}

/**
 * @Catch() with no arguments will catch all unhandled exceptions.
 * This is the core of our global exception interception implementation.
 */
@Catch()
@Injectable()
export class AppExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger('ocean.chat.app.exception.filter')
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status: HttpStatus;
    let code: number;
    let message: string;
    let errorType: 'Business' | 'System' = 'System'; // Default to system exception

    // 1. Identify the exception type and set the corresponding status code, error code, and message
    if (exception instanceof BusinessException) {
      // Handle custom business exceptions
      errorType = 'Business';
      status = HttpStatus.OK; // Business exceptions usually return 200 OK, differentiated by the 'code' field
      code = exception.getErrorCode();
      message = exception.getResponse() as string;
    } else if (exception instanceof HttpException) {
      // Handle NestJS built-in HTTP exceptions
      status = exception.getStatus();
      code = status;
      message = exception.message;
    } else if (exception instanceof RpcException) {
      // Handle RPC exceptions between microservices
      // RpcException payload is usually a string or an object, which needs to be parsed
      const rpcError = exception.getError();
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 500;
      message =
        typeof rpcError === 'string' ? rpcError : JSON.stringify(rpcError);
    } else {
      // Handle all other unhandled exceptions
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 500;
      message = 'Internal Server Error';
    }

    const errorResponse: ErrorResponse = {
      code,
      message,
      type: errorType,
    };

    // 2. Log the exception
    // Only system exceptions need to log the full stack trace. For business exceptions, logging the message is usually sufficient.
    if (errorType === 'System') {
      this.logger.error(
        `[System Exception] Message: ${message}, Stack: ${(exception as Error).stack}`,
        JSON.stringify(request.body), // Log the request body
      );
    } else {
      this.logger.warn(`[Business Exception] Message: ${message}`);
    }

    // 3. Send the response based on the execution context (HTTP, WS, RPC)
    const requestType = host.getType();

    if (requestType === 'http') {
      // HTTP request
      errorResponse.path = request.url;
      errorResponse.timestamp = new Date().toISOString();
      response.status(status).json(errorResponse);
    } else if (requestType === 'ws') {
      // WebSocket request
      // For WS, we don't "respond", but "emit" an event
      const client = host.switchToWs().getClient<WebSocket>();
      if (client.readyState === WebSocket.OPEN) {
        // before sending, ensure the connection is still open
        client.send(JSON.stringify({ event: 'error', data: errorResponse }));
      }
    } else if (requestType === 'rpc') {
      // RPC request (microservice)
      // For RPC, it should directly return or throw an exception object that can be received by the client
      // NestJS will handle the serialization automatically
      return new RpcException(errorResponse);
    }
  }
}
