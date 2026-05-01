import { ErrorCodes } from '../constants/error-codes.enum';
import { ExceptionType, IAppException } from './app.exception';

/**
 * The foundational class for all Infrastructure (System) exceptions.
 *
 * Infrastructure exceptions represent unexpected errors caused by the environment,
 * third-party services, or internal bugs (e.g., RedisConnectionException, DatabaseTimeout).
 * They are conceptually "the server's fault".
 *
 * Characteristics:
 * - They MUST log full stack traces to aid debugging.
 * - They typically result in HTTP 5xx status codes.
 * - The actual error message should be sanitized before reaching the client to prevent data leaks.
 * - Some infrastructure exceptions might be marked as retriable (e.g. transient network glitches).
 */
export class InfrastructureException extends Error implements IAppException {
  public readonly exceptionType: ExceptionType = 'INFRASTRUCTURE';

  /**
   * @param message The internal error message (will be logged, but might be sanitized for the client).
   * @param errorCode A unique, application-specific error code.
   * @param statusCode The HTTP status code (defaults to 500).
   * @param isRetriable Whether this error is transient and can be retried.
   * @param details Additional context for logging.
   */
  constructor(
    public readonly message: string,
    public readonly errorCode: number = ErrorCodes.UNEXPECTED_ERROR,
    public readonly statusCode: number = 500,
    public readonly isRetriable: boolean = false,
    public readonly details?: Record<string, unknown> & { cause?: unknown },
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, InfrastructureException.prototype);
  }

  getErrorCode(): number {
    return this.errorCode;
  }

  getStatusCode(): number {
    return this.statusCode;
  }

  getDetails(): Record<string, unknown> | undefined {
    return this.details;
  }
}
