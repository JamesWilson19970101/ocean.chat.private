import { RpcException } from '@nestjs/microservices';

import { ErrorCodes } from '../constants/error-codes.enum';

/**
 * The foundational class for all custom RPC (Remote Procedure Call) exceptions within the application.
 *
 * This class extends NestJS's built-in `RpcException` to provide a standardized
 * structure for errors occurring in microservice communication. It includes a custom
 * `errorCode` and an optional `details` object, allowing for consistent error
 * handling, machine-readable error codes for RPC clients, and detailed context
 * for logging and debugging.
 *
 * Unlike `BaseException` which passes a structured `response` object to `HttpException`'s
 * constructor, `BaseRpcException` passes the primary `message` string directly to its
 * parent `RpcException`'s constructor. The `errorCode` and `details` are stored
 * as properties of this class itself. This design ensures compatibility with
 * `RpcException`'s expected payload while still providing structured custom data
 * that can be accessed via getters in the `AllExceptionsFilter`.
 *
 * @example
 * ```typescript
 * import { ErrorCodes } from '../constants/error-codes.enum';
 * import { BaseRpcException } from './rpc.exception';
 *
 * export class UserRpcNotFoundException extends BaseRpcException {
 *   constructor(userId: string) {
 *     super(
 *       `User with ID ${userId} not found.`, // This is the primary message for the RPC client
 *       ErrorCodes.USER_NOT_FOUND,
 *       { userId } // Additional details for logging
 *     );
 *   }
 * }
 * ```
 *
 * @see AllExceptionsFilter where this exception is caught and processed.
 * @extends RpcException
 */
export class BaseRpcException extends RpcException {
  /**
   * @param message The primary error message string. This message is passed directly to the parent `RpcException`.
   * @param statusCode The HTTP status code.
   * @param errorCode A unique, application-specific error code. Defaults to `UNEXPECTED_ERROR`.
   * @param details An optional object containing additional, non-public information for logging and debugging.
   */
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly errorCode: number = ErrorCodes.UNEXPECTED_ERROR,
    public readonly details?: {
      [key: string]: any;
      cause?: Record<string, any>;
    },
  ) {
    // Pass the primary message directly to the parent RpcException.
    // The errorCode and details are stored as properties of this class for structured access.
    super(message);
  }

  /**
   * Only the microservice (Provider) knows whether the "user not found" error is due to a database crash (which should return a 500 error) or because the user doesn't actually exist (which should return a 404 error).
   * The api-gateway ultimately needs to return errors generated during RPC calls to the front end via HTTP. Therefore, to ensure that the api-gateway can return errors semantically, an HTTP status code must be added.
   * @returns
   */
  getStatusCode(): number {
    return this.statusCode;
  }

  /**
   * Retrieves the application-specific error code.
   * @returns The numeric error code.
   */
  public getErrorCode(): number {
    return this.errorCode;
  }

  /**
   * Retrieves the additional details object associated with the exception.
   * @returns The details object, or undefined if not provided.
   */
  public getDetails(): any {
    return this.details;
  }
}
