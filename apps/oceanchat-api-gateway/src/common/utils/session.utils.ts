/**
 * Generates the Redis key for a JWT session.
 * @param jti The JWT ID (jti claim).
 * @returns The formatted Redis session key, e.g., "session:uuid-goes-here".
 */
export const getAccessSessionKey = (jti: string): string =>
  `access-session:${jti}`;

/**
 * Generates the Redis key for a JWT refresh token session.
 * @param jti The JWT ID (jti claim) of the refresh token.
 * @returns The formatted Redis session key, e.g., "refresh-session:uuid-goes-here".
 */
export const getRefreshSessionKey = (jti: string): string =>
  `refresh-session:${jti}`;
