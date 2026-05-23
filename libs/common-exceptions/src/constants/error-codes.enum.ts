/**
 * Defines business-specific error codes for the application.
 */
export enum ErrorCodes {
  // ---------------------------------------Http Error Codes--------------------------------------------- //

  USERNAME_ALREADY_EXISTS = 10001, // e.g., when trying to register with an existing username
  // username validation errors
  USERNAME_TOO_SHORT = 10002, // e.g., less than 3 characters
  USERNAME_TOO_LONG = 10003, // e.g., more than 20 characters
  USERNAME_INVALID_CHARACTERS = 10004, // e.g., contains special characters not allowed
  // password validation errors
  PASSWORD_TOO_SHORT = 10010, // e.g., less than 8 characters
  PASSWORD_NO_DIGIT = 10011, // e.g., does not contain at least one numeric digit
  PASSWORD_NO_LOWERCASE = 10012, // e.g., does not contain at least one lowercase letter
  PASSWORD_NO_UPPERCASE = 10013, // e.g., does not contain at least one uppercase letter
  PASSWORD_NO_SPECIAL_CHAR = 10014, // e.g., does not contain at least one special character
  // login errors
  INVALID_CREDENTIALS = 10020, // e.g., incorrect username or password
  USER_NOT_FOUND = 10021, // e.g., when a user is requested but does not exist
  CREATION_ERROR = 10022, // e.g., for general creation failures
  // authentication errors

  REFRESH_TOKEN_REUSED_OR_REVOKED = 10031, // e.g., when a refresh token is used more than once or its session is not found in Redis

  TOKEN_REFRESH_ERROR = 10032, // e.g., when encountering database or redis level issues.

  // idempotency key conflict error
  IDEMPOTENCY_CONFLICT = 10050,

  // Sequence/ID Generator errors
  INVALID_SEQUENCE_KEY = 40000, // e.g., when a sequence key contains invalid characters

  // Event/Message errors
  MALFORMED_EVENT = 40001, // e.g., when a NATS event fails schema validation

  // Authorization errors
  FAILED_TO_FETCH_SCOPED_ROLES = 20001, // e.g., when the scope provider fails to return roles
  ERROR_CODE_TOKEN_EXPIRED = 20002, // e.g., token expired

  // Service-level errors
  SERVICE_ERROR = 50300, // e.g., a downstream microservice is not responding
  SERVICE_UNAVAILABLE = 50301, // e.g., circuit breaker is open

  UNEXPECTED_ERROR = 99999, // e.g., for unexpected errors not covered by other codes

  // ---------------------------------------Common Error Codes--------------------------------------------- //

  RATE_LIMIT_EXCEEDED = 42900, // e.g., when a client or connection exceeds the allowed request rate
  UNAUTHORIZED = 10030, // e.g., when accessing a protected resource without valid authentication

  // ------------------------------------- WebSocket Error Codes----------------------------------------------- //

  // WebSocket & Gateway Specific Errors
  WS_CLOSE_SERVICE_RESTART = 1012, // Standard WebSocket close code for service restart
  WS_CLOSE_HANDSHAKE_TIMEOUT = 4008, // Custom WebSocket close code for handshake timeout
}

/**
 * Framework-agnostic HTTP/Transport status codes.
 * Use this instead of NestJS's HttpStatus to keep the ws layer pure.
 */
export enum AppStatus {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}
