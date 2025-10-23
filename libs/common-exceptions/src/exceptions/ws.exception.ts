import { WsException } from '@nestjs/websockets';

import { ErrorCodes } from '../constants/error-codes.enum';

/**
 * The foundational class for all custom WebSocket exceptions within the application.
 *
 * This class extends NestJS's built-in `WsException` to provide a standardized
 * structure for errors occurring in WebSocket communication. It includes a custom
 * `errorCode` and an optional `details` object, allowing for consistent error
 * handling and detailed context for logging.
 *
 * Similar to `BaseRpcException`, this class passes the primary `message` string
 * directly to its parent `WsException`'s constructor. The `errorCode` and `details`
 * are stored as properties of this class itself. This design ensures compatibility
 * with `WsException`'s expected payload while still providing structured custom data
 * that can be accessed via getters in the `AllExceptionsFilter`.
 *
 * @example
 * ```typescript
 * import { ErrorCodes } from '../constants/error-codes.enum';
 * import { BaseWsException } from './ws.exception';
 *
 * export class InvalidWsActionException extends BaseWsException {
 *   constructor(action: string) {
 *     super(
 *       `Invalid WebSocket action: ${action}`,
 *       ErrorCodes.INVALID_WS_ACTION, // Assuming this code exists
 *       { action } // Additional details for logging
 *     );
 *   }
 * }
 * ```
 *
 * @see AllExceptionsFilter where this exception is caught and processed.
 * @extends WsException
 */
export class BaseWsException extends WsException {
  /**
   * @param message The primary error message string. This message is passed directly to the parent `WsException`.
   * @param errorCode A unique, application-specific error code. Defaults to `UNEXPECTED_ERROR`.
   * @param details An optional object containing additional, non-public information for logging and debugging.
   */
  constructor(
    public readonly message: string,
    public readonly errorCode: number = ErrorCodes.UNEXPECTED_ERROR,
    public readonly details?: { [key: string]: any; cause?: Error },
  ) {
    // Pass the primary message directly to the parent WsException.
    // The errorCode and details are stored as properties of this class for structured access.
    super(message);
  }

  /**
   * Retrieves the application-specific error code.
   * @returns The numeric error code.
   */
  public getErrorCode(): number {
    return this.errorCode;
  }

  /**
   * Retrieves the additional details object associated with the exception.
   * @returns The details object, or undefined if not provided.
   */
  public getDetails(): any {
    return this.details;
  }
}
