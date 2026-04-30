import { ErrorCodes } from '../constants/error-codes.enum';

/**
 * A pure business exception interface, decoupled from any specific transport protocol (HTTP/RPC/WS).
 */
export interface IAppException {
  readonly message: string;
  readonly errorCode: number;
  readonly statusCode: number;
  readonly details?: Record<string, any> | undefined;

  getErrorCode(): number;
  getStatusCode(): number;
  getDetails(): Record<string, any> | undefined;
}

/**
 * A pure business logic exception that implements IAppException.
 * It extends the native Error class and is not bound to NestJS HttpException or RpcException.
 * Ideal for use in Services, NATS Subscribers, Cron jobs, or any protocol-agnostic layer.
 */
export class AppException extends Error implements IAppException {
  constructor(
    public readonly message: string,
    public readonly errorCode: number = ErrorCodes.UNEXPECTED_ERROR,
    public readonly statusCode: number = 400, // Default to Bad Request for business errors
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Set the prototype explicitly to ensure correct prototype chain when extending Error in TypeScript
    Object.setPrototypeOf(this, AppException.prototype);
  }

  getErrorCode(): number {
    return this.errorCode;
  }

  getStatusCode(): number {
    return this.statusCode;
  }

  getDetails(): Record<string, any> | undefined {
    return this.details;
  }
}
