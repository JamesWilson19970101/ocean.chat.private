/**
 * standardized error response DTO for microservices and HTTP APIs.
 * This DTO is used to ensure consistent error responses across different services and protocols.
 */
export class ErrorResponseDto {
  /**
   * HTTP status code
   * @example 404
   */
  statusCode: number;

  /**
   * timestamp of when the error occurred
   * @example "2023-10-27T08:00:00.000Z"
   */
  timestamp: string;

  /**
   *  The request path that caused the error
   * @example "/users/123"
   */
  path?: string;

  /**
   * The name of the service where the error originated
   * @example "oceanchat-auth"
   */
  serviceName: string;

  /**
   * A business-specific error code for precise handling by the client or service caller
   * @example 99999 // e.g., for unexpected errors not covered by other codes
   */
  errorCode: number;

  /**
   * The error message or object
   * @example "User with ID 123 not found."
   */
  message: string | object;

  /**
   * The type of error: 'Business' for predictable business logic errors, 'System' for unexpected system errors
   * @example { "field": "email", "error": "must be a valid email" }
   */
  details?: any;

  constructor(partial: Partial<ErrorResponseDto>) {
    Object.assign(this, partial);
  }
}
