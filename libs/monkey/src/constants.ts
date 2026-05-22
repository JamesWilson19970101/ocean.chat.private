/**
 * Monkey Protocol Heartbeat Constraints.
 * Defines the absolute timings for the Asymmetric Time Difference Keep-Alive Mechanism.
 * @see docs/monkey-asymmetric-heartbeat.md
 */
export const MonkeyHeartbeat = {
  /**
   * Gateway Sweep Interval (ms).
   * Gateway scans all connections every 5 seconds to reduce event loop pressure.
   */
  SWEEP_INTERVAL: 5000,

  /**
   * Handshake Timeout Threshold (ms).
   * A physical TCP connection must complete authentication (AUTH_REQ) within 5 seconds.
   */
  HANDSHAKE_TIMEOUT: 5000,

  /**
   * Server Idle PING Threshold (ms).
   * The gateway will proactively send a PING [0x03] if no packets are received for 30 seconds.
   */
  SERVER_PING_INTERVAL: 30000,

  /**
   * Client Idle PING Threshold (ms).
   * The client SDK will proactively send a PING if no packets are received for 35 seconds.
   * This is a fallback to avoid simultaneous dual-PING collisions.
   */
  CLIENT_PING_INTERVAL: 35000,

  /**
   * Dead Connection Timeout Threshold (ms).
   * Connection is declared dead and forcefully terminated if completely silent for 60 seconds.
   */
  DEAD_TIMEOUT: 60000,
} as const;

/**
 * Monkey Protocol Version Negotiation Constraints.
 * Defines the supported versions for smooth client upgrades.
 * @see docs/monkey-version-negotiation.md
 */
export const MonkeyVersion = {
  /**
   * The list of protocol versions currently supported by this Gateway node.
   * If a client's Header Version is not in this list, the connection is rejected via EXCEPTION_ACK (426).
   */
  SUPPORTED_VERSIONS: [1],
} as const;
