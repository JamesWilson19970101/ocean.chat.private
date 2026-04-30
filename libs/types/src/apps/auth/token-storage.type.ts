/**
 * Interface representing the token structure stored in the Redis whitelist.
 * This object is serialized as a JSON string and stored in the Redis Hash value.
 *
 * Redis Structure:
 * Key: auth:user:{userId}
 * Field: {deviceId}
 * Value: JSON.stringify(ITokenStorage)
 */
export interface ITokenStorage {
  /**
   * The current valid access token string.
   * The gateway compares the incoming token with this value to ensure it hasn't been replaced.
   */
  accessToken: string;

  /**
   * The current valid refresh token string.
   * Used by the auth service to validate refresh requests.
   */
  refreshToken: string;

  /**
   * The JTI (JWT ID) of the access token.
   * Can be used for faster validation or logging.
   */
  accessJti?: string;

  /**
   * The JTI (JWT ID) of the refresh token.
   */
  refreshJti?: string;

  /**
   * Timestamp (ms) of the last activity or when the token was issued.
   */
  lastActive?: number;
}
