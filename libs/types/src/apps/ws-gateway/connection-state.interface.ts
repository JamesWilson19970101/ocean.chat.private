/**
 * Represents the authentication status of a WebSocket connection in the gateway.
 */
export enum ConnectionAuthStatus {
  /** Connection has just been established, waiting for AUTH_REQ */
  PENDING = 'PENDING',
  /** Connection has been successfully authenticated */
  AUTHENTICATED = 'AUTHENTICATED',
  /** Authentication failed or timed out */
  FAILED = 'FAILED',
}

/**
 * Interface defining the state attached to a WebSocket connection
 * for lifecycle management and smart heartbeat in the WS gateway.
 */
export interface GatewayConnectionState {
  /**
   * The timestamp (in milliseconds) of the last received valid packet.
   * Used for the "Business Packet as Heartbeat" (业务包即心跳) strategy.
   */
  lastActiveTime: number;

  /**
   * The current authentication status of the connection.
   */
  authStatus: ConnectionAuthStatus;

  /**
   * The authenticated user's ID.
   * Defined only when authStatus is AUTHENTICATED.
   */
  userId?: string;

  /**
   * The device ID from the authentication request.
   * Defined only when authStatus is AUTHENTICATED.
   */
  deviceId?: string;
}
