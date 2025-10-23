import { HttpException } from '@nestjs/common';

import { ErrorCodes } from '../constants/error-codes.enum';

/**
 * The foundational class for all custom business exceptions within the application.
 *
 * This class is designed to decouple business logic from the transport layer (e.g., HTTP).
 * While it extends NestJS's `HttpException`, this is an **implementation detail** chosen
 * for seamless integration with NestJS's exception handling pipeline.
 *
 * The name `BaseException` reflects its core purpose: to serve as a generic model for
 * application-level errors, providing a standardized contract with an `errorCode` and
 * optional `details`. This allows service-layer code to throw meaningful, protocol-agnostic
 * business exceptions, which are then translated into appropriate protocol-specific
 * responses by filters like `AllExceptionsFilter`.
 *
 * @example
 * ```typescript
 * import { HttpStatus } from '@nestjs/common';
 * import { ErrorCodes } from '../constants/error-codes.enum';
 * import { BaseException } from './base.exception';
 *
 * // Create a specific business exception
 * export class UserNotFoundException extends BaseException {
 *   constructor(userId: string) {
 *     super(
 *       'User not found', // This is the public message
 *       HttpStatus.NOT_FOUND,
 *       ErrorCodes.USER_NOT_FOUND,
 *       { userId } // Additional details for logging
 *     );
 *   }
 * }
 * ```
 *
 * @see AllExceptionsFilter where this exception is caught and processed.
 * @extends HttpException
 */
export class BaseException extends HttpException {
  /**
   * @param response The response body. Can be a simple string message or a structured object.
   * @param status The HTTP status code.
   * @param errorCode A unique, application-specific error code. Defaults to `UNEXPECTED_ERROR`.
   * @param details An optional object containing additional, non-public information for logging and debugging.
   */
  constructor(
    response: string | Record<string, any>,
    status: number,
    public readonly errorCode: number = ErrorCodes.UNEXPECTED_ERROR,
    public readonly details?: { [key: string]: any; cause?: Error },
  ) {
    super(response, status);
  }

  /**
   * Retrieves the application-specific error code.
   * @returns The numeric error code.
   */
  getErrorCode(): number {
    return this.errorCode;
  }

  /**
   * Retrieves the additional details object associated with the exception.
   * @returns The details object, or undefined if not provided.
   */
  getDetails(): any {
    return this.details;
  }
}
