import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * @class PasswordService
 * @description A service that provides password hashing and verification functionality.
 * It uses the `argon2` library, which is a modern and secure password hashing algorithm.
 */
@Injectable()
export class PasswordService {
  /**
   * Hashes a plaintext password using the Argon2 algorithm.
   * @param password - The plaintext password to hash.
   * @returns A promise that resolves to the hashed password string.
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  /**
   * Verifies if a plaintext password matches a given hash.
   * @param hash - The hashed password stored in the database.
   * @param plain - The plaintext password provided by the user.
   * @returns A promise that resolves to `true` if the passwords match, otherwise `false`.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
