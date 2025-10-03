import { RpcException } from '@nestjs/microservices';

import { ErrorCodes } from '../constants/error-codes.enum';

/**
 * Base class for RPC exceptions with structured error information.
 * Extends the RpcException to include error codes and additional details.
 *
 * @example
 * export class UserRpcNotFoundException extends BaseRpcException {
 * constructor(userId: string) {
 * super(
 * `User with ID ${userId} not found.`,
 * ErrorCode.USER_NOT_FOUND
 * );
 * }
 * }
 */
export class BaseRpcException extends RpcException {
  constructor(
    public readonly message: string,
    public readonly errorCode: number = ErrorCodes.UNEXPECTED_ERROR,
    public readonly details?: any,
  ) {
    // RpcException typically wraps an error object or message.
    super({
      message,
      errorCode,
      details,
    });
  }
}
