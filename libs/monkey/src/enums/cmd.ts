/**
 * Monkey Protocol Command Identifiers.
 * Used in the `cmd` field of the 12-byte header.
 * Values range from 0x01 to 0x0B.
 */
export enum MonkeyCmd {
  /** Request connection authentication. Payload contains DeviceType, DeviceId, and JWT. */
  AUTH_REQ = 0x01,
  /** Authentication result response. */
  AUTH_ACK = 0x02,
  /** Keep-alive heartbeat request. Payload must be empty. */
  PING = 0x03,
  /** Keep-alive heartbeat response. Payload must be empty. */
  PONG = 0x04,
  /** Client-to-server upstream chat message. */
  MSG_UP = 0x05,
  /** Server-to-client acknowledgment for upstream message. */
  MSG_UP_ACK = 0x06,
  /** Server-to-client push notification. Only contains session metadata and SyncSeqId. */
  MSG_NOTIFY = 0x08,
  /** Multi-device read receipt synchronization signal. */
  READ_RECEIPT = 0x0b,
  /** Global exception response. */
  EXCEPTION_ACK = 0x0c,
}
