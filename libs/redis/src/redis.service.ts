import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { RedisKey, RedisValue } from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { REDIS_CLIENT, RedisClient } from './redis.provider';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @InjectPinoLogger('redis.module') private readonly logger: PinoLogger,
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient,
  ) {}

  /**
   * The module is being destroyed.
   * Close the redis connection.
   */
  onModuleDestroy() {
    this.logger?.info('Disconnecting Redis client...');
    this.redisClient.disconnect();
  }

  getClient(): RedisClient {
    return this.redisClient;
  }

  /**
   * Get a value from redis.
   * @param key The key.
   * @returns The value.
   */
  async get<T>(key: RedisKey): Promise<T | null> {
    const value = await this.redisClient.get(key);
    if (value) {
      try {
        return JSON.parse(value) as T;
      } catch (error) {
        this.logger?.warn(
          { key, value, error: (error as Error).message },
          `Failed to parse Redis value for key "${Buffer.isBuffer(key) ? key.toString() : key}" as JSON. Returning raw string.`,
        );
        return value as unknown as T;
      }
    }
    return null;
  }

  /**
   * Set a value in redis.
   * @param key The key.
   * @param value The value.
   * @param ttl The time to live in seconds.
   */
  async set(key: RedisKey, value: unknown, ttl?: number): Promise<'OK'> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      return this.redisClient.set(key, serializedValue, 'EX', ttl);
    }
    return this.redisClient.set(key, serializedValue);
  }

  /**
   * Atomically sets a key if it does not exist, with a specified TTL.
   * This is the primitive for implementing a distributed lock.
   * @param key The key to set.
   * @param value The value to set.
   * @param ttl The time to live in seconds.
   * @returns 'OK' if the key was set, or null if the key already existed.
   */
  async setnx(
    key: RedisKey,
    value: RedisValue,
    ttl: number,
  ): Promise<'OK' | null> {
    // Use 'EX' for seconds and 'NX' to set only if the key does not exist.
    return this.redisClient.set(key, value, 'EX', ttl, 'NX');
  }

  /**
   * Delete a key from redis.
   * @param key The key or keys to delete.
   * @returns The number of keys that were removed.
   */
  async del(key: RedisKey | RedisKey[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) {
      return 0;
    }
    return this.redisClient.del(...keys);
  }

  /**
   * hset a field in a hash.
   * @param key The key of the hash.
   * @param field The field to set.
   * @param value The value to set.
   * @returns The number of fields that were added.
   */
  async hset(key: RedisKey, field: string, value: RedisValue): Promise<number> {
    return this.redisClient.hset(key, field, value);
  }
}
