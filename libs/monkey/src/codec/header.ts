import { MonkeyCmd } from '../enums/cmd';
/**
 * Represents the structure of the 12-byte Monkey Protocol Header.
 */
export interface HeaderData {
  /** 2 bytes: Magic number (0x4D4B). */
  magic: number;
  /** 1 byte: Protocol version (0x01). */
  version: number;
  /** 1 byte: Command identifier (MonkeyCmd). */
  cmd: MonkeyCmd;
  /** 1 byte: Bitmask flags (MonkeyFlags). */
  flags: number;
  /**
   * 3 bytes: Request ID for RPC matching.
   * Cycles from 1 to 16777215.
   *
   * Convention:
   * - Client requests: Must be > 0.
   * - Server-side unsolicited push (Server Push): Must be strictly 0.
   */
  reqId: number;
  /** 4 bytes: Length of the variable Payload in bytes. */
  length: number;
}

/**
 * Codec for the 12-byte Monkey Protocol Header.
 * Handles strict big-endian serialization and deserialization.
 */
export class MonkeyHeader {
  /** Total fixed size of the header in bytes. */
  public static readonly SIZE = 12;
  /** Protocol magic number ("MK"). */
  public static readonly MAGIC = 0x4d4b;
  /** Current protocol version. */
  public static readonly VERSION = 0x01;

  /**
   * Encodes header data into a 12-byte Buffer.
   *
   * @param data Header data excluding magic and version (handled automatically).
   * @returns A Buffer of length 12.
   * @throws Error if reqId is out of the 3-byte unsigned integer range.
   */
  static encode(data: Omit<HeaderData, 'magic' | 'version'>): Buffer {
    const buffer = Buffer.allocUnsafe(MonkeyHeader.SIZE);

    // Magic: 0x4D4B (2 bytes)
    buffer.writeUInt16BE(MonkeyHeader.MAGIC, 0);
    // Version: 0x01 (1 byte)
    buffer.writeUInt8(MonkeyHeader.VERSION, 2);
    // Cmd (1 byte)
    buffer.writeUInt8(data.cmd, 3);
    // Flags (1 byte)
    buffer.writeUInt8(data.flags, 4);

    // ReqId (3 bytes, UInt24)
    // Range check: 0 is reserved for Server Push, 1-16777215 for RPC.
    if (data.reqId < 0 || data.reqId > 0xffffff) {
      throw new Error(
        `reqId out of bounds. Must be between 0 and 16777215, got ${data.reqId}`,
      );
    }
    buffer.writeUIntBE(data.reqId, 5, 3);

    // Length (4 bytes)
    buffer.writeUInt32BE(data.length, 8);

    return buffer;
  }

  /**
   * Decodes a Buffer into a HeaderData object.
   *
   * @param buffer The buffer to decode (must be at least 12 bytes).
   * @returns The decoded header data.
   * @throws Error if the buffer is smaller than 12 bytes.
   */
  static decode(buffer: Buffer): HeaderData {
    if (buffer.length < MonkeyHeader.SIZE) {
      throw new Error(
        `Buffer too small. Expected at least ${MonkeyHeader.SIZE} bytes`,
      );
    }

    return {
      magic: buffer.readUInt16BE(0),
      version: buffer.readUInt8(2),
      cmd: buffer.readUInt8(3) as MonkeyCmd,
      flags: buffer.readUInt8(4),
      reqId: buffer.readUIntBE(5, 3),
      length: buffer.readUInt32BE(8),
    };
  }
}
