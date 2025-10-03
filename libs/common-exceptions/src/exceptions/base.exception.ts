import { HttpException } from '@nestjs/common';

import { ErrorCodes } from '../constants/error-codes.enum';

/**
 * Base exception class for custom exceptions in the application.
 * Extends NestJS's HttpException to include additional properties like errorCode and details.
 * This class can be further extended to create specific exception types.
 */
export class BaseException extends HttpException {
  constructor(
    response: string | Record<string, any>,
    status: number,
    private readonly errorCode: number = ErrorCodes.UNEXPECTED_ERROR,
    private readonly details?: any,
  ) {
    super(response, status);
  }

  getErrorCode(): number {
    return this.errorCode;
  }

  getDetails(): any {
    return this.details;
  }
}
