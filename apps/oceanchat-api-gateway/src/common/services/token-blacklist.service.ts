import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Event-Driven In-Memory Blacklist for Zero-I/O Authentication.
 * Maintains a local LRU cache of revoked JWT IDs (jti).
 */
@Injectable()
export class TokenBlacklistService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Adds a revoked JWT ID to the local memory blacklist.
   * @param jti The JWT ID.
   * @param expSeconds The absolute expiration time of the token in seconds (unix timestamp).
   */
  async add(jti: string, expSeconds: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    // Calculate the remaining time to live in milliseconds
    const ttlSeconds = expSeconds - now;

    // Only add to cache if the token hasn't already mathematically expired
    if (ttlSeconds > 0) {
      // cache-manager v5+ uses milliseconds for ttl
      await this.cacheManager.set(jti, true, ttlSeconds * 1000);
    }
  }

  /**
   * Performs an O(1) local memory lookup to check if a token is revoked.
   * @param jti The JWT ID.
   * @returns true if the token is blacklisted, false otherwise.
   */
  async isRevoked(jti: string): Promise<boolean> {
    const isRevoked = await this.cacheManager.get<boolean>(jti);
    return !!isRevoked;
  }
}
