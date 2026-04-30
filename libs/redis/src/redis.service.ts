import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import { RedisKey, RedisValue } from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { REDIS_CLIENT, RedisClient } from './redis.provider';

export interface GetOrSetOptions {
  /** Time to live in seconds for the cached value. */
  ttl: number;
  /** Time to live in seconds for a null/undefined value (negative cache). */
  nullTtl?: number;
  /** Time to live in seconds for the distributed lock. */
  lockTtl?: number;
  /** Time to wait in milliseconds before retrying if a lock is not acquired. */
  lockWaitTime?: number;
  /** Add a random jitter to the TTL to prevent stampedes on expiry. Max value in seconds. */
  ttlJitter?: number;
}

export interface IdempotencyResult<T> {
  /** Indicates the outcome of the idempotency check. */
  status: 'EXECUTED' | 'CONFLICT' | 'CACHED';
  /** The HTTP status code to return. */
  statusCode: number;
  /** The response body. */
  body: T | { message: string };
}

export interface IdempotencyOptions {
  /** Time to live in seconds for the "processing" lock. */
  processingTtl: number;
  /** Time to live in seconds for the final cached response. */
  cacheTtl: number;
  /** Add a random jitter to the cache TTL to prevent stampedes on expiry. Max value in seconds. */
  ttlJitter?: number;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @InjectPinoLogger('redis.module') private readonly logger: PinoLogger,
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * The module is being destroyed.
   * Close the redis connection.
   */
  onModuleDestroy() {
    this.logger?.info(this.i18nService.translate('Redis_Client_Closing'));
    this.redisClient.disconnect(); // Then disconnect the Redis client
  }

  getClient(): RedisClient {
    return this.redisClient;
  }

  /**
   * Get a value from redis.
   * @param key The key.
   * @returns The value.
   */
  async get(key: RedisKey): Promise<string | null> {
    return await this.redisClient.get(key);
  }

  /**
   * Set a value in redis.
   * @param key The key.
   * @param value The value.
   * @param ttl The time to live in seconds.
   */
  async set<T>(key: RedisKey, value: T, ttl?: number): Promise<'OK'> {
    let valueToStore: RedisValue;

    if (typeof value === 'string' || Buffer.isBuffer(value)) {
      // For strings and Buffers, store them directly.
      valueToStore = value;
    } else {
      // For objects, arrays, etc., JSON.stringify them.
      valueToStore = JSON.stringify(value);
    }

    if (ttl) {
      return await this.redisClient.set(key, valueToStore, 'EX', ttl);
    }
    return await this.redisClient.set(key, valueToStore);
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
    return await this.redisClient.set(key, value, 'EX', ttl, 'NX');
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
    return await this.redisClient.del(...keys);
  }

  /**
   * Atomically gets the value of a key and then deletes the key.
   * Useful for implementing one-time-use tokens or locks.
   * @param key The key to get and delete.
   * @returns The value of the key, or null if the key does not exist.
   */
  async getAndDelete<T>(key: RedisKey): Promise<T | null> {
    // This Lua script ensures atomicity of the GET and DEL operations.
    const LUA_SCRIPT_GET_AND_DELETE = `
      local value = redis.call('get', KEYS[1])
      if value then
        redis.call('del', KEYS[1])
      end
      return value
    `;
    const result = await this.eval(LUA_SCRIPT_GET_AND_DELETE, [key], []);
    return result as T | null;
  }

  /**
   * Executes a Lua script. This is useful for performing atomic operations.
   * @param script The Lua script to execute.
   * @param keys An array of key names, accessible in Lua via the KEYS table.
   * @param args An array of argument values, accessible in Lua via the ARGV table.
   * @returns The result of the script execution.
   */
  async eval(
    script: string,
    keys: (string | Buffer)[],
    args: (string | Buffer | number)[],
  ): Promise<unknown> {
    // ioredis's eval signature is: eval(script, numberOfKeys, key1, key2, ..., arg1, arg2, ...)
    // I use the spread operator to pass keys and args correctly.
    return await this.redisClient.eval(script, keys.length, ...keys, ...args);
  }

  /**
   * hset a field in a hash.
   * @param key The key of the hash.
   * @param field The field to set.
   * @param value The value to set.
   * @returns The number of fields that were added.
   */
  async hset(key: RedisKey, field: string, value: RedisValue): Promise<number> {
    return await this.redisClient.hset(key, field, value);
  }

  /**
   * Delete one or more hash fields.
   * @param key The key of the hash.
   * @param fields The fields to delete.
   * @returns The number of fields that were removed.
   */
  async hdel(key: RedisKey, ...fields: string[]): Promise<number> {
    return await this.redisClient.hdel(key, ...fields);
  }

  /**
   * Get a value from a hash field.
   * @param key The key of the hash.
   * @param field The field to get.
   * @returns The value or null if not found.
   */
  async hget(key: RedisKey, field: string): Promise<string | null> {
    return await this.redisClient.hget(key, field);
  }

  /**
   * Sets multiple key-value pairs in Redis.
   * @param args An array of key-value pairs, e.g., ['key1', 'value1', 'key2', 'value2'].
   * @returns 'OK' if all keys were set successfully.
   */
  async mset(args: (RedisKey | RedisValue)[]): Promise<'OK'> {
    // ioredis's mset expects arguments as (key1, value1, key2, value2, ...)
    // The spread operator (...) unpacks the array into individual arguments.
    return await this.redisClient.mset(...args);
  }

  /**
   * Sets a timeout on key. After the timeout has expired, the key will automatically be deleted.
   * @param key The key to set the expiration on.
   * @param seconds The time to live in seconds.
   * @returns 1 if the timeout was set, 0 if the key does not exist or the timeout could not be set.
   */
  async expire(key: RedisKey, seconds: number): Promise<number> {
    return await this.redisClient.expire(key, seconds);
  }

  /**
   * Implements the cache-aside pattern with distributed locking to prevent cache stampedes.
   * It attempts to fetch a value from the cache. If missed, it acquires a lock,
   * executes the `fetcher` function to get the fresh value, caches it, and releases the lock.
   *
   * getOrSet means:
   * 1. Try to get the value from cache.
   * 2. If cache miss, try to acquire a distributed lock.
   * 3. If lock acquired, call the fetcher function to get the value, set it in cache, and release the lock.
   *
   * @template T The type of the value to be cached.
   * @param key The cache key.
   * @param fetcher An async function that returns the value to be cached.
   * @param options Configuration for TTL, locking, and negative caching.
   * @returns The value from the cache or the fetcher.
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T | null>,
    options: GetOrSetOptions,
  ): Promise<T | null | string> {
    const { lockTtl = 10, lockWaitTime = 100, ttlJitter = 0 } = options;
    // 1. Try to get from cache.
    // Use the raw client here to differentiate between a missing key (null)
    // and a cached null value (the string "null").
    const rawCachedValue = await this.redisClient.get(key);

    if (rawCachedValue !== null) {
      this.logger.debug(this.i18nService.translate('Cache_Hit', { key }));

      return rawCachedValue;
    }

    // 2. Cache miss, try to acquire a distributed lock
    const lockKey = `${key}:lock`;
    const lockAcquired = (await this.setnx(lockKey, '1', lockTtl)) === 'OK';

    if (lockAcquired) {
      this.logger.debug(
        this.i18nService.translate('Cache_Miss_Lock_Acquired', { key }),
      );
      try {
        // 3. Got the lock, fetch from the data source
        const value = await fetcher();

        // 4. Set cache
        const { ttl, nullTtl = 300 } = options;
        const valueToCache = value ?? null; // Keep null as null for serialization
        const effectiveTtl =
          value !== null && value !== undefined
            ? ttl + Math.floor(Math.random() * ttlJitter)
            : nullTtl;

        if (effectiveTtl > 0) {
          await this.set(key, valueToCache, effectiveTtl);
        }
        return value;
      } finally {
        // Release the lock by deleting the lock key
        await this.del(lockKey).catch((err) =>
          this.logger.error({ err, key }, 'Lock_Release_Failed'),
        );
      }
    } else {
      // 6. Lock not acquired, wait and retry getting from cache
      this.logger.debug(
        { key },
        this.i18nService.translate('Cache_Miss_Lock_Not_Acquired', { key }),
      );

      // Bounded retry loop to prevent stack overflow and indefinite waits.
      const totalWaitTime = lockTtl * 1000 * 0.8; // Wait for max 80% of lock TTL
      const startTime = Date.now();

      while (Date.now() - startTime < totalWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, lockWaitTime));

        const retryValue = await this.get(key).catch(() => null);
        if (retryValue !== null && retryValue !== undefined) {
          this.logger.debug({ key }, 'Retry successful, value found in cache.');
          return retryValue;
        }
      }

      // If all retries fail, fetch from the source directly as a last resort.
      this.logger.warn(
        { key },
        this.i18nService.translate('Retry_Failed_Fallback_To_Null'),
      );
      return null;
    }
  }
}
