import * as crypto from 'crypto';

import { MonkeyProcessor } from '../src/codec/processor';

describe('MonkeyProcessor', () => {
  describe('Compression (COMPRESSED flag)', () => {
    it('should compress and decompress a payload correctly', async () => {
      const originalPayload = Buffer.from(
        'This is a test payload that should be compressed. '.repeat(50),
      );

      const compressed = await MonkeyProcessor.compress(originalPayload);
      expect(compressed.length).toBeLessThan(originalPayload.length);

      const decompressed = await MonkeyProcessor.decompress(compressed);
      expect(decompressed.toString()).toEqual(originalPayload.toString());
    });

    it('should throw error when decompressing invalid data', async () => {
      const invalidData = Buffer.from('not compressed data');
      await expect(MonkeyProcessor.decompress(invalidData)).rejects.toThrow();
    });
  });

  describe('Encryption (ENCRYPTED flag)', () => {
    const validKey = crypto.randomBytes(32);
    const originalPayload = Buffer.from('Super secret monkey data');

    it('should encrypt and decrypt a payload correctly', () => {
      const encrypted = MonkeyProcessor.encrypt(originalPayload, validKey);

      // Encrypted length should be payload + 12 (IV) + 16 (Auth Tag)
      expect(encrypted.length).toEqual(originalPayload.length + 28);
      // It should not expose the plaintext
      expect(encrypted.includes(originalPayload)).toBeFalsy();

      const decrypted = MonkeyProcessor.decrypt(encrypted, validKey);
      expect(decrypted.toString()).toEqual(originalPayload.toString());
    });

    it('should throw an error if encryption key is not 32 bytes', () => {
      const invalidKey = crypto.randomBytes(16);
      expect(() =>
        MonkeyProcessor.encrypt(originalPayload, invalidKey),
      ).toThrow('Invalid key length');
    });

    it('should throw an error if decryption key is not 32 bytes', () => {
      const encrypted = MonkeyProcessor.encrypt(originalPayload, validKey);
      const invalidKey = crypto.randomBytes(16);
      expect(() => MonkeyProcessor.decrypt(encrypted, invalidKey)).toThrow(
        'Invalid key length',
      );
    });

    it('should throw an error if encrypted payload is too short', () => {
      const tooShortPayload = Buffer.from('short');
      expect(() => MonkeyProcessor.decrypt(tooShortPayload, validKey)).toThrow(
        'Invalid payload length',
      );
    });

    it('should fail decryption if data is tampered with', () => {
      const encrypted = MonkeyProcessor.encrypt(originalPayload, validKey);
      // Tamper with the encrypted data (modify a byte in the middle)
      encrypted[15] = encrypted[15] ^ 0xff;

      expect(() => MonkeyProcessor.decrypt(encrypted, validKey)).toThrow();
    });

    it('should fail decryption if Auth Tag is tampered with', () => {
      const encrypted = MonkeyProcessor.encrypt(originalPayload, validKey);
      // Tamper with the auth tag (last 16 bytes)
      encrypted[encrypted.length - 1] = encrypted[encrypted.length - 1] ^ 0xff;

      expect(() => MonkeyProcessor.decrypt(encrypted, validKey)).toThrow();
    });
  });
});
