import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

/**
 * @author James
 * @class PasswordUtils
 */
export class PasswordUtils {
  static generateSalt(): string {
    return randomBytes(16).toString('hex');
  }

  static async hashPassword(password: string, salt: string): Promise<string> {
    const hash = await argon2.hash(password, {
      salt: Buffer.from(salt, 'hex'),
      type: argon2.argon2d,
      memoryCost: 2 ** 16,
      timeCost: 20,
      parallelism: 2,
    });
    return hash;
  }
  static async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return await argon2.verify(hash, password);
  }
}
