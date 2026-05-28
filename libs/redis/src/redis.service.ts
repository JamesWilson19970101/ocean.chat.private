import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  ErrorCodes,
  InfrastructureException,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { RedisKey, RedisValue } from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';

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
   * Atomically deletes a key only if its current value matches the expected value.
   * This is crucial for safely releasing distributed locks to prevent deleting another pod's lock.
   * @param key The key of the lock.
   * @param expectedValue The value originally set when the lock was acquired.
   * @returns 1 if the key was deleted, 0 otherwise.
   */
  async delIfEqual(key: RedisKey, expectedValue: RedisValue): Promise<number> {
    const LUA_SCRIPT_DEL_IF_EQUAL = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.eval(
      LUA_SCRIPT_DEL_IF_EQUAL,
      [key],
      [expectedValue as string],
    );
    return result as number;
  }

  /**
   * Atomically deletes a hash field only if a specific property in its JSON value matches the expected value.
   * This is crucial for safely removing session states stored as JSON without race conditions.
   * @param key The key of the hash.
   * @param field The field to delete within the hash.
   * @param jsonProperty The property inside the JSON object to check.
   * @param expectedValue The expected value of the property (compared as a string).
   * @returns 1 if the field was deleted, 0 otherwise.
   */
  async hdelIfJsonPropertyEquals(
    key: RedisKey,
    field: string,
    jsonProperty: string,
    expectedValue: RedisValue,
  ): Promise<number> {
    const LUA_SCRIPT = `
      local val = redis.call("hget", KEYS[1], ARGV[1])
      if val then
        local status, decoded = pcall(cjson.decode, val)
        if status and tostring(decoded[ARGV[2]]) == ARGV[3] then
          return redis.call("hdel", KEYS[1], ARGV[1])
        end
      end
      return 0
    `;
    const result = await this.eval(
      LUA_SCRIPT,
      [key],
      [field, jsonProperty, expectedValue as string],
    );
    return result as number;
  }

  /**
   * Atomically adds a message sequence ID to a ZSET and trims it to maintain a sliding window.
   * I use syncSeqId as BOTH the score (for chronological sorting) and the member (for uniqueness).
   * This minimalist approach enables extremely fast O(log(N)) unread badge counting.
   *
   * @param key The key of the ZSET.
   * @param seqId The sequence ID of the message.
   * @param limit The maximum number of latest messages to retain (default: 100).
   */
  async addMessageToSlidingWindow(
    key: RedisKey,
    seqId: string,
    limit: number = 100,
  ): Promise<void> {
    const LUA_SCRIPT = `
      redis.call("ZADD", KEYS[1], ARGV[1], ARGV[1])
      redis.call("ZREMRANGEBYRANK", KEYS[1], 0, tonumber(ARGV[2]))
    `;
    const stopRank = -(limit + 1); // e.g., limit 100 -> stopRank -101
    await this.eval(LUA_SCRIPT, [key], [seqId, stopRank]);
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
   * Set a field in a hash, or multiple fields using an object.
   * @param key The key of the hash.
   * @param fieldOrObj The field to set, or an object containing multiple field-value pairs.
   * @param value The value to set (if setting a single field).
   * @returns The number of fields that were added.
   */
  hset(key: RedisKey, field: string, value: RedisValue): Promise<number>;
  hset(key: RedisKey, obj: Record<string, RedisValue>): Promise<number>;
  async hset(
    key: RedisKey,
    fieldOrObj: string | Record<string, RedisValue>,
    value?: RedisValue,
  ): Promise<number> {
    if (typeof fieldOrObj === 'string') {
      // TypeScript knows 'value' is provided in the single-field overload
      return await this.redisClient.hset(key, fieldOrObj, value as RedisValue);
    } else {
      return await this.redisClient.hset(key, fieldOrObj);
    }
  }

  /**
   * Atomically sets a field in a hash and independently sets its expiration time (Requires Redis 7.4+).
   * @param key The key of the hash.
   * @param field The field to set.
   * @param value The value to set.
   * @param seconds The time to live in seconds for this specific field.
   */
  async hsetWithFieldExpire(
    key: RedisKey,
    field: string,
    value: RedisValue,
    seconds: number,
  ): Promise<void> {
    const client = this.redisClient;
    const multi = client.multi();
    multi.hset(key, field, value);
    multi.call('HEXPIRE', key, seconds, 'FIELDS', 1, field);

    await multi.exec();
  }

  /**
   * Independently sets the expiration time for a specific field in a hash (Requires Redis 7.4+).
   * @param key The key of the hash.
   * @param field The field to set expiration on.
   * @param seconds The time to live in seconds for this specific field.
   */
  async hexpire(key: RedisKey, field: string, seconds: number): Promise<void> {
    // Directly use the raw call for the Redis 7.4+ HEXPIRE command
    // ioredis client supports .call() for arbitrary/new commands
    await this.redisClient.call('HEXPIRE', key, seconds, 'FIELDS', 1, field);
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
   * Get all fields and values of a hash.
   * @param key The key of the hash.
   * @returns An object representing the hash fields and values.
   */
  async hgetall(key: RedisKey): Promise<Record<string, string>> {
    return await this.redisClient.hgetall(key);
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
  ): Promise<T | null> {
    const {
      ttl,
      nullTtl = 10,
      lockTtl = 10,
      lockWaitTime = 100,
      ttlJitter = 30,
    } = options;

    const lockKey = `${key}:lock`;
    const lockValue = uuidv7();

    // The maximum total time to wait.
    // Should be larger than lockTtl to allow the lock to expire and be re-acquired by waiting pods.
    const MAX_WAIT_MS = lockTtl * 1000 * 1.5;
    const startTime = Date.now();

    // Unified Spin-Lock Loop
    while (Date.now() - startTime < MAX_WAIT_MS) {
      // 1. Try to get from cache
      const rawCachedValue = await this.redisClient.get(key);
      if (rawCachedValue !== null) {
        this.logger.debug(this.i18nService.translate('Cache_Hit', { key }));
        if (rawCachedValue === 'null') return null;
        try {
          return JSON.parse(rawCachedValue) as T;
        } catch {
          return rawCachedValue as unknown as T;
        }
      }

      // 2. Cache miss, try to acquire distributed lock
      const lockAcquired =
        (await this.setnx(lockKey, lockValue, lockTtl)) === 'OK';
      if (lockAcquired) {
        this.logger.debug(
          this.i18nService.translate('Cache_Miss_Lock_Acquired', { key }),
        );
        try {
          // 3. Got the lock, fetch from the data source
          const value = await fetcher();
          const stringifiedValue = JSON.stringify(value ?? null);
          const effectiveTtl =
            value !== null && value !== undefined
              ? ttl + Math.floor(Math.random() * ttlJitter)
              : nullTtl;

          if (effectiveTtl > 0) {
            await this.set(key, stringifiedValue, effectiveTtl);
          }
          return value;
        } finally {
          // Safely release the lock only if it still belongs to this process
          await this.delIfEqual(lockKey, lockValue).catch((err) =>
            this.logger.error(
              { err, key },
              this.i18nService.translate('Lock_Release_Failed', { key }),
            ),
          );
        }
      }

      // 4. Lock not acquired. Someone else is fetching. Wait and retry.
      await new Promise((resolve) => setTimeout(resolve, lockWaitTime));
    }

    // 5. Fail-Fast: If we waited MAX_WAIT_MS and still nothing, protect the database by shedding load.
    this.logger.error(
      { key, MAX_WAIT_MS },
      this.i18nService.translate('CACHE_LOCK_TIMEOUT_PREVENT_STAMPEDE', {
        defaultValue:
          'Cache lock wait timeout. Throwing error to prevent database stampede.',
      }),
    );

    throw new InfrastructureException(
      this.i18nService.translate('Service_Unavailable', {
        defaultValue: 'Service Unavailable',
      }),
      ErrorCodes.SERVICE_UNAVAILABLE,
      503,
      false,
      {
        cause: this.i18nService.translate('CACHE_LOCK_TIMEOUT_CAUSE', {
          defaultValue:
            'Timeout waiting for cache lock on key: {{key}}. Potential database bottleneck or lock starvation.',
          key,
        }),
      },
    );
  }
}
