/**
 * The fundamental nature of the exception.
 * - 'DOMAIN': Predictable errors resulting from invalid user input or business rule violations (client's fault).
 * - 'INFRASTRUCTURE': Unexpected errors caused by the environment, third-party services, or internal bugs (server's fault).
 */
export type ExceptionType = 'DOMAIN' | 'INFRASTRUCTURE';

/**
 * A pure business exception interface, decoupled from any specific transport protocol (HTTP/RPC/WS).
 */
export interface IAppException extends Error {
  readonly message: string;
  readonly errorCode: number;
  readonly statusCode: number;
  readonly exceptionType: ExceptionType;
  readonly isRetriable?: boolean;
  readonly details?: Record<string, unknown> | undefined;

  getErrorCode(): number;
  getStatusCode(): number;
  getDetails(): Record<string, unknown> | undefined;
}
