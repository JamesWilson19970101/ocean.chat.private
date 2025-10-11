import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import { RedisKey, RedisValue } from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as CircuitBreaker from 'opossum';

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

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisBreaker: CircuitBreaker;

  constructor(
    @InjectPinoLogger('redis.module') private readonly logger: PinoLogger,
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient,
    private readonly i18nService: I18nService,
  ) {
    // Configure the circuit breaker for Redis
    const options: CircuitBreaker.Options = {
      timeout: 3000, // If the function does not return in 3 seconds, trigger a failure
      errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
      resetTimeout: 30000, // After 30 seconds in open state, try again (half-open)
    };

    // We wrap all redis.service operations. The action is the method name on RedisService.
    this.redisBreaker = new CircuitBreaker(
      (action: keyof RedisClient, ...args: any[]) =>
        (this.redisClient[action] as (...a: any[]) => Promise<any>)(...args),
      options,
    );

    // Log state changes for observability
    // open means the circuit is now open and calls will be blocked.
    this.redisBreaker.on('open', () =>
      this.logger.warn(this.i18nService.translate('Redis_Breaker_Opened')),
    );
    // close means the circuit is now closed and calls will be allowed.
    this.redisBreaker.on('close', () =>
      this.logger.info(this.i18nService.translate('Redis_Breaker_Closed')),
    );
    // halfOpen allows the next request to test if Redis is healthy; if the call is successful, the circuit will be closed; if it fails, the circuit will be opened again.
    this.redisBreaker.on('halfOpen', () =>
      this.logger.info(this.i18nService.translate('Redis_Breaker_HalfOpen')),
    );
  }

  /**
   * The module is being destroyed.
   * Close the redis connection.
   */
  onModuleDestroy() {
    this.logger?.info(this.i18nService.translate('Redis_Client_Closing'));
    this.redisBreaker.shutdown(); // Gracefully shutdown the breaker and the underlying client
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
  async get<T>(key: RedisKey): Promise<T | null> {
    const value = (await this.redisBreaker.fire('get', key)) as string | null;
    if (value) {
      try {
        return JSON.parse(value) as T;
      } catch (error) {
        this.logger?.warn(
          { key, error: (error as Error).message },
          this.i18nService.translate('Failed_to_parse_redis_value', {
            key: Buffer.isBuffer(key) ? key.toString() : key,
          }),
        );
        // if JSON.parse fails, return the raw value
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
      return (await this.redisBreaker.fire(
        'set',
        key,
        serializedValue,
        'EX',
        ttl,
      )) as 'OK';
    }
    return (await this.redisBreaker.fire('set', key, serializedValue)) as 'OK';
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
    return (await this.redisBreaker.fire(
      'set',
      key,
      value,
      'EX',
      ttl,
      'NX',
    )) as 'OK' | null;
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
    return (await this.redisBreaker.fire('del', ...keys)) as number;
  }

  /**
   * hset a field in a hash.
   * @param key The key of the hash.
   * @param field The field to set.
   * @param value The value to set.
   * @returns The number of fields that were added.
   */
  async hset(key: RedisKey, field: string, value: RedisValue): Promise<number> {
    return (await this.redisBreaker.fire('hset', key, field, value)) as number;
  }

  /**
   * Sets multiple key-value pairs in Redis.
   * @param args An array of key-value pairs, e.g., ['key1', 'value1', 'key2', 'value2'].
   * @returns 'OK' if all keys were set successfully.
   */
  async mset(args: (RedisKey | RedisValue)[]): Promise<'OK'> {
    // ioredis's mset expects arguments as (key1, value1, key2, value2, ...)
    // The spread operator (...) unpacks the array into individual arguments.
    return (await this.redisBreaker.fire('mset', ...args)) as 'OK';
  }

  /**
   * Sets a timeout on key. After the timeout has expired, the key will automatically be deleted.
   * @param key The key to set the expiration on.
   * @param seconds The time to live in seconds.
   * @returns 1 if the timeout was set, 0 if the key does not exist or the timeout could not be set.
   */
  async expire(key: RedisKey, seconds: number): Promise<number> {
    return (await this.redisBreaker.fire('expire', key, seconds)) as number;
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
    fetcher: () => Promise<T>,
    options: GetOrSetOptions,
  ): Promise<T | null> {
    const {
      ttl,
      nullTtl = 300,
      lockTtl = 10,
      lockWaitTime = 100,
      ttlJitter = 0,
    } = options;

    // 1. Try to get from cache first, wrapped in the circuit breaker
    try {
      const cachedValue = await this.get<T>(key);
      if (cachedValue !== null) {
        this.logger.debug(
          { key },
          this.i18nService.translate('Cache_Hit', { key }),
        );
        return cachedValue;
      }
    } catch (error) {
      this.logger.error(
        { err: error, key, breakerState: this.redisBreaker.stats },
        this.i18nService.translate('Cache_Get_Failed_Fallback'),
      );

      // If cache read fails, proceed directly to the fetcher, bypassing the lock.
      // The circuit breaker will prevent hammering a down Redis.
      return fetcher();
    }

    // 2. Cache miss, try to acquire a distributed lock
    const lockKey = `${key}:lock`;
    let lockAcquired = false;

    try {
      const result = await this.setnx(lockKey, '1', lockTtl);
      lockAcquired = result === 'OK';
    } catch (error) {
      this.logger.error(
        { err: error, key, breakerState: this.redisBreaker.stats },
        this.i18nService.translate('Lock_Acquire_Failed'),
      );
      // Fallback: If Redis is down, we can't get a lock.
      // Proceed to fetch directly to keep the application functional.
      return fetcher();
    }

    if (lockAcquired) {
      this.logger.debug(
        { key },
        this.i18nService.translate('Cache_Miss_Lock_Acquired', { key }),
      );

      try {
        // 3. Got the lock, fetch from the data source
        const value = await fetcher();

        // 4. Set cache
        const valueToCache = value ?? null;
        const effectiveTtl =
          value !== null && value !== undefined
            ? ttl + Math.floor(Math.random() * ttlJitter)
            : nullTtl;

        if (effectiveTtl > 0) {
          await this.set(key, valueToCache, effectiveTtl);
        }

        return value;
      } catch (error) {
        this.logger.error(
          { err: error, key },
          this.i18nService.translate('DB_Fetch_Or_Cache_Set_Error'),
        );
        // Re-throw the error from the fetcher so the caller can handle it.
        throw error;
      } finally {
        // Release the lock by deleting the lock key
        // 5. Release the lock
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

      // Wait before retrying to get from cache
      await new Promise((resolve) => setTimeout(resolve, lockWaitTime));

      // Retry the whole process
      return this.getOrSet(key, fetcher, options);
    }
  }
}
