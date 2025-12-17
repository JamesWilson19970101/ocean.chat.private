/**
 * Constants related to authentication and authorization.
 */
export const AUTH_CONSTANTS = {
  /**
   * Redis key prefix for user authentication data.
   * Structure: auth:user:{userId}
   * The field in the Hash will be the {deviceId}.
   */
  REDIS_USER_PREFIX: 'auth:user:',

  /**
   * HTTP Header key used to indicate that the token has expired.
   * This allows the frontend to distinguish between a missing token and an expired one.
   */
  HEADER_TOKEN_EXPIRED: 'x-token-expired',
} as const;
