import { ErrorCodes } from '../constants/error-codes.enum';
import { ExceptionType, IAppException } from './app.exception';

/**
 * The foundational class for all Domain (Business) exceptions.
 *
 * Domain exceptions represent predictable errors resulting from invalid user input
 * or business rule violations (e.g., UserNotFound, InvalidPassword, InsufficientBalance).
 * They are conceptually "the client's fault".
 *
 * Characteristics:
 * - They do NOT log full stack traces by default (to save CPU/I/O under high load).
 * - They typically result in HTTP 4xx status codes.
 * - They are almost never retriable.
 *
 * TODO: isRetriable
 */
export class DomainException extends Error implements IAppException {
  public readonly exceptionType: ExceptionType = 'DOMAIN';
  public readonly isRetriable: boolean = false;

  constructor(
    public readonly message: string,
    public readonly errorCode: number = ErrorCodes.UNEXPECTED_ERROR,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, DomainException.prototype);
  }

  getErrorCode(): number {
    return this.errorCode;
  }

  getStatusCode(): number | undefined {
    return this.statusCode;
  }

  getDetails(): Record<string, unknown> | undefined {
    return this.details;
  }
}
