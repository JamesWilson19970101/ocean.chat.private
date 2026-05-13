import { HeaderData, MonkeyHeader } from './header';

/**
 * WebSocket Framer for Monkey Protocol.
 * Since WebSocket natively preserves message boundaries, this class acts as an
 * integrity validator rather than a stream aggregator.
 */
export class MonkeyFramer {
  /**
   * Validates a complete WebSocket message buffer and extracts the Payload.
   * Verifies magic number and ensures buffer length matches header length field.
   *
   * @param buffer The raw WebSocket message Buffer.
   * @returns Object containing the decoded header and the payload subarray.
   * @throws Error if magic number or payload length is invalid.
   */
  static unframeWSMessage(buffer: Buffer): {
    header: HeaderData;
    payload: Buffer;
  } {
    if (buffer.length < MonkeyHeader.SIZE) {
      throw new Error('Buffer too small to contain Monkey Header');
    }

    const header = MonkeyHeader.decode(buffer);

    if (header.magic !== MonkeyHeader.MAGIC) {
      throw new Error('Invalid Magic Number');
    }

    if (buffer.length !== MonkeyHeader.SIZE + header.length) {
      throw new Error(
        `Payload length mismatch. Expected ${header.length}, got ${
          buffer.length - MonkeyHeader.SIZE
        }`,
      );
    }

    const payload = buffer.subarray(MonkeyHeader.SIZE);
    return { header, payload };
  }

  /**
   * Packs Header data and Protobuf Payload into a single contiguous Buffer for WS transmission.
   *
   * @param headerData Header parameters (magic, version, and length are handled automatically).
   * @param payload The Protobuf-encoded payload buffer.
   * @returns A Buffer ready for WebSocket send().
   */
  static frameWSMessage(
    headerData: Omit<HeaderData, 'magic' | 'version' | 'length'>,
    payload: Buffer,
  ): Buffer {
    const length = payload.length;

    const headerBuffer = MonkeyHeader.encode({
      ...headerData,
      length,
    });

    return Buffer.concat([headerBuffer, payload]);
  }
}
