import * as crypto from 'crypto';
import { promisify } from 'util';
import * as zlib from 'zlib';

const inflate = promisify(zlib.inflate);
const deflate = promisify(zlib.deflate);

/**
 * Pure functions for handling Monkey Protocol payload flags (COMPRESSED, ENCRYPTED).
 * Operates on Buffer and returns Buffer without any I/O side effects.
 */
export class MonkeyProcessor {
  /**
   * Compresses the payload using zlib (deflate).
   *
   * @param payload The original Buffer.
   * @returns Compressed Buffer.
   */
  static async compress(payload: Buffer): Promise<Buffer> {
    return deflate(payload);
  }

  /**
   * Decompresses the payload using zlib (inflate).
   *
   * @param payload The compressed Buffer.
   * @returns Decompressed Buffer.
   */
  static async decompress(payload: Buffer): Promise<Buffer> {
    return inflate(payload);
  }

  /**
   * Encrypts the payload using AES-256-GCM.
   * Automatically generates a random 12-byte IV and appends the 16-byte Auth Tag.
   * Format: [IV (12 bytes)] + [Encrypted Data] + [Auth Tag (16 bytes)]
   *
   * @param payload The plain Buffer.
   * @param key 32-byte (256-bit) encryption key.
   * @returns Encrypted Buffer with IV and Auth Tag.
   */
  static encrypt(payload: Buffer, key: Buffer): Buffer {
    if (key.length !== 32) {
      throw new Error(
        'Invalid key length: AES-256-GCM requires a 32-byte key.',
      );
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, encrypted, authTag]);
  }

  /**
   * Decrypts an AES-256-GCM encrypted payload.
   * Assumes the format: [IV (12 bytes)] + [Encrypted Data] + [Auth Tag (16 bytes)]
   *
   * @param payload The encrypted Buffer containing IV and Auth Tag.
   * @param key 32-byte (256-bit) decryption key.
   * @returns Decrypted plain Buffer.
   */
  static decrypt(payload: Buffer, key: Buffer): Buffer {
    if (key.length !== 32) {
      throw new Error(
        'Invalid key length: AES-256-GCM requires a 32-byte key.',
      );
    }

    if (payload.length < 28) {
      throw new Error(
        'Invalid payload length: too short to contain IV and Auth Tag.',
      );
    }

    const iv = payload.subarray(0, 12);
    const authTag = payload.subarray(payload.length - 16);
    const encryptedData = payload.subarray(12, payload.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }
}
