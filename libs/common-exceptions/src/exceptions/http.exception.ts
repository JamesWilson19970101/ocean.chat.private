import { HttpStatus } from '@nestjs/common';

import { BaseException } from './base.exception';

/**
 * Base class for HTTP exceptions with structured error information.
 * Extends the BaseException to include HTTP status codes and error codes.
 *
 * @example
 * export class UserNotFoundException extends BaseHttpException {
 * constructor(userId: string) {
 * super(
 * `User with ID ${userId} not found.`,
 * HttpStatus.NOT_FOUND,
 * ErrorCode.USER_NOT_FOUND
 * );
 * }
 * }
 */
export class BaseHttpException extends BaseException {
  constructor(
    message: string,
    status: HttpStatus,
    errorCode: number,
    details?: any,
  ) {
    super(message, status, errorCode, details);
  }
}
