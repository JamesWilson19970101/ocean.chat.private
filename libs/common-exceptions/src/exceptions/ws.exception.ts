import { WsException } from '@nestjs/websockets';

import { ErrorCodes } from '../constants/error-codes.enum';

/**
 * Base class for WebSocket exceptions with structured error information.
 * Extends the WsException to include error codes and additional details.
 *
 * @example
 * export class InvalidWsActionException extends BaseWsException {
 *   constructor(action: string) {
 *     super(
 *       `Invalid WebSocket action: ${action}`,
 *       ErrorCodes.INVALID_WS_ACTION // Assuming this code exists
 *     );
 *   }
 * }
 */
export class BaseWsException extends WsException {
  constructor(
    public readonly message: string,
    public readonly errorCode: number = ErrorCodes.UNEXPECTED_ERROR,
    public readonly details?: { [key: string]: any; cause?: Error },
  ) {
    super({ message, errorCode, details });
  }
}
