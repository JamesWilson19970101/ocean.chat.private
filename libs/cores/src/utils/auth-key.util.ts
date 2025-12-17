import { AUTH_CONSTANTS } from '../constants/auth.constants';

/**
 * Utility class for generating authentication-related Redis keys.
 */
export class AuthKeyUtil {
  /**
   * Generates the Redis key for a specific user's authentication data.
   *
   * @param userId - The unique identifier of the user.
   * @returns The formatted Redis key (e.g., "auth:user:1001").
   *
   * @example
   * const key = AuthKeyUtil.getUserKey(1001); // "auth:user:1001"
   */
  static getUserKey(userId: string): string {
    return `${AUTH_CONSTANTS.REDIS_USER_PREFIX}${userId}`;
  }
}
