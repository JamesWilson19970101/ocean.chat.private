import { IAppException } from '../exceptions/app.exception';

/**
 * Checks if an error implements the IAppException interface.
 * @param error The error to check.
 * @returns True if the error is an IAppException.
 */
export function isAppException(error: unknown): error is IAppException {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as Record<string, unknown>;
  return (
    typeof candidate.getErrorCode === 'function' &&
    typeof candidate.getStatusCode === 'function' &&
    typeof candidate.getDetails === 'function' &&
    typeof candidate.errorCode === 'number' &&
    typeof candidate.statusCode === 'number' &&
    (candidate.exceptionType === 'DOMAIN' ||
      candidate.exceptionType === 'INFRASTRUCTURE')
  );
}
