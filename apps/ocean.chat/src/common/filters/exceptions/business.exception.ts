import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom business exception class.
 * Used to throw predictable, non-system-level errors in business logic.
 * e.g., user not found, incorrect password, insufficient balance, etc.
 *
 * @param message The error message.
 * @param errorCode A business-specific error code for precise handling by the client or service caller.
 */
export class BusinessException extends HttpException {
  private readonly errorCode: number;

  constructor(message: string, errorCode: number) {
    // It's recommended to use a unified HTTP status for business exceptions, like 200 or a specific 4xx code.
    // Here we use HttpStatus.OK (200), indicating the request was processed successfully, but the business logic failed.
    // The client should use the 'errorCode' in the response body to determine the specific type of business error.
    super(message, HttpStatus.OK);
    this.errorCode = errorCode;
  }

  getErrorCode(): number {
    return this.errorCode;
  }
}
