/**
 * Interface representing the payload of a JSON Web Token (JWT).
 * This structure is embedded within the signed token.
 */
export interface IJwtPayload {
  /**
   * The subject of the token, typically the User ID.
   */
  sub: string;

  /**
   * The username of the authenticated user.
   */
  username: string;

  /**
   * The unique identifier for the device (e.g., "mobile", "desktop", "web-uuid").
   * This is crucial for the multi-device login and whitelist mechanism.
   */
  deviceId: string;

  /**
   * JWT ID. A unique identifier for the token itself.
   */
  jti: string;

  /**
   * Issued At timestamp (seconds since Unix epoch).
   */
  iat?: number;

  /**
   * Expiration timestamp (seconds since Unix epoch).
   */
  exp?: number;
}
