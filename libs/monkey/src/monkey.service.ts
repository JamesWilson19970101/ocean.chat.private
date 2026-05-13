import { Injectable } from '@nestjs/common';

import { MonkeyFramer } from './codec/framer';
import { HeaderData, MonkeyHeader } from './codec/header';

/**
 * NestJS Service wrapper for Monkey Protocol codec logic.
 * Provides a dependency-injectable interface for microservices to handle
 * framing and header manipulation.
 */
@Injectable()
export class MonkeyService {
  /**
   * Encodes header data into a 12-byte Buffer.
   *
   * @param data Header data (excluding magic/version).
   * @returns 12-byte Buffer.
   */
  encodeHeader(data: Omit<HeaderData, 'magic' | 'version'>): Buffer {
    return MonkeyHeader.encode(data);
  }

  /**
   * Decodes a 12-byte Buffer into header data.
   *
   * @param buffer Header buffer.
   * @returns Decoded HeaderData.
   */
  decodeHeader(buffer: Buffer): HeaderData {
    return MonkeyHeader.decode(buffer);
  }

  /**
   * Frames a Protobuf payload with a Monkey Header for WebSocket transmission.
   *
   * @param headerData Header metadata.
   * @param payload Binary payload.
   * @returns Combined Buffer.
   */
  frame(
    headerData: Omit<HeaderData, 'magic' | 'version' | 'length'>,
    payload: Buffer,
  ): Buffer {
    return MonkeyFramer.frameWSMessage(headerData, payload);
  }

  /**
   * Unframes a received WebSocket message and validates its integrity.
   *
   * @param buffer Received message buffer.
   * @returns Object with header and payload.
   * @throws Error if integrity check fails.
   */
  unframe(buffer: Buffer): { header: HeaderData; payload: Buffer } {
    return MonkeyFramer.unframeWSMessage(buffer);
  }
}
