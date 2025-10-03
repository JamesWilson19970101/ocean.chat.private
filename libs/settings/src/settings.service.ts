import { Injectable, OnModuleInit } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import type { Setting } from '@ocean.chat/models';
import { SettingsRepository } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as CircuitBreaker from 'opossum';

import { DefaultSetting, defaultSettings } from './default-settings';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly CACHE_KEY_PREFIX = 'setting:';
  // Cache TTLs(time to live) in seconds
  private readonly CACHE_TTL_SECONDS = 3600; // 1 hour
  private readonly LOCK_TTL_SECONDS = 10; // Lock expires after 10 seconds
  private readonly CACHE_NULL_TTL_SECONDS = 300; // 5 minutes
  private readonly redisBreaker: CircuitBreaker;

  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly redisService: RedisService,
    @InjectPinoLogger('lib.settings.settings.service')
    private readonly logger: PinoLogger,
    private readonly i18nService: I18nService,
  ) {
    // Configure the circuit breaker for Redis
    const options: CircuitBreaker.Options = {
      timeout: 3000, // If the function does not return in 3 seconds, trigger a failure
      errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
      resetTimeout: 30000, // After 30 seconds in open state, try again (half-open)
    };

    // We wrap the entire redisService instance.
    // The action passed to fire() will be the method name we want to call.
    this.redisBreaker = new CircuitBreaker(
      (action: keyof RedisService, ...args: any[]) =>
        (this.redisService[action] as (...a: any[]) => Promise<any>)(...args),
      options,
    );

    // Log state changes for observability
    this.redisBreaker.on('open', () =>
      this.logger.warn(this.i18nService.translate('Redis_Breaker_Opened')),
    );
    this.redisBreaker.on('close', () =>
      this.logger.info(this.i18nService.translate('Redis_Breaker_Closed')),
    );
    this.redisBreaker.on('halfOpen', () =>
      this.logger.info(
        this.i18nService.translate('Redis_Breaker_HalfOpen', {
          resetTimeout: options.resetTimeout,
        }),
      ),
    );
  }

  /**
   * Initializes default settings when the module is loaded by iterating
   * through the `defaultSettings` array.
   * This ensures that essential settings are present in the database on first startup.
   * It also pre-warms the cache by loading all settings from the database into Redis.
   */
  async onModuleInit() {
    try {
      this.logger.info('Initializing default settings...');
      for (const setting of defaultSettings) {
        await this.createDefaultSetting(setting);
      }
      this.logger.info('Default settings initialization complete.');

      this.logger.info('Pre-warming settings cache from database...');
      await this._loadAllSettingsToCache();
      this.logger.info('Settings cache pre-warming complete.');
    } catch (error) {
      this.logger.error(
        { err: error },
        'Failed to initialize settings during onModuleInit.',
      );
    }
  }

  /**
   * Creates a default setting if it does not already exist in the database.
   * @param setting The default setting to create if it does not already exist.
   */
  private async createDefaultSetting(setting: DefaultSetting) {
    await this.settingsRepository.createIfNotExists(setting);
  }

  /**
   *  get setting prefixed cache key
   * @param key  setting key
   * @returns the cache key with prefix
   */
  private getCacheKey(key: string): string {
    return `${this.CACHE_KEY_PREFIX}${key}`;
  }

  /**
   * get setting lock key
   * @param key setting key
   * @returns the lock key for the setting
   */
  private getLockKey(key: string): string {
    return `${this.getCacheKey(key)}:lock`;
  }

  /**
   * Retrieves the value of a setting by its key.
   * It implements the cache-aside pattern with Redis.
   * @param key setting key
   * @returns The value of the setting associated with the provided key, or null if no such setting exists.
   */
  async getSettingValue(key: string): Promise<Setting['value'] | null> {
    const cacheKey = this.getCacheKey(key);

    try {
      // 1. Try to get from cache first, wrapped in the circuit breaker
      const cachedValue = (await this.redisBreaker.fire('get', cacheKey)) as
        | Setting['value']
        | null;
      if (cachedValue) {
        this.logger.debug(
          { key },
          this.i18nService.translate('Cache_Hit_For_Setting'),
        );
        return cachedValue;
      }
    } catch (error) {
      this.logger.error(
        { err: error, key, breakerState: this.redisBreaker.stats },
        this.i18nService.translate('Cache_Get_Failed_Fallback'),
      );
    }

    // 2. Cache miss, try to acquire a distributed lock
    const lockKey = this.getLockKey(key);
    let lockAcquired = false;
    try {
      // This operation is also wrapped in the breaker
      const result = await this.redisBreaker.fire(
        'setnx',
        lockKey,
        '1',
        this.LOCK_TTL_SECONDS,
      );
      lockAcquired = result === 'OK';
    } catch (error) {
      this.logger.error(
        { err: error, key, breakerState: this.redisBreaker.stats },
        this.i18nService.translate('Lock_Acquire_Failed'),
      );
      // Fallback: If Redis is down, we can't get a lock.
      // We proceed as if we got it to ensure the DB is still queried.
      lockAcquired = true;
    }

    if (lockAcquired) {
      this.logger.debug(
        { key },
        this.i18nService.translate('Cache_Miss_Lock_Acquired'),
      );
      try {
        // 3. Got the lock, fetch from database
        const setting = await this.settingsRepository.findByKey(key);
        const valueToCache = setting ? setting.value : null;

        // 4. Try to set cache (this will also be protected by the breaker)
        try {
          const ttl = setting
            ? this.CACHE_TTL_SECONDS + Math.floor(Math.random() * 300)
            : this.CACHE_NULL_TTL_SECONDS;
          await this.redisBreaker.fire('set', cacheKey, valueToCache, ttl);
        } catch (error) {
          this.logger.error(
            { err: error, key, breakerState: this.redisBreaker.stats },
            this.i18nService.translate('Cache_Set_Failed_After_DB'),
          );
        }
        return valueToCache;
      } catch (error) {
        this.logger.error(
          { err: error, key },
          this.i18nService.translate('DB_Fetch_Or_Cache_Set_Error'),
        );
        throw error;
      } finally {
        // 5. Release the lock (gracefully handle failure)
        try {
          // Don't wait for this if the breaker is open, it will fail anyway
          if (this.redisBreaker.closed) {
            await this.redisBreaker.fire('del', lockKey);
          }
        } catch (error) {
          this.logger.error(
            { err: error, key, breakerState: this.redisBreaker.stats },
            this.i18nService.translate('Lock_Release_Failed'),
          );
        }
      }
    } else {
      // 6. Did not get the lock, another process is fetching. Wait and retry.
      this.logger.debug(
        { key },
        this.i18nService.translate('Cache_Miss_Lock_Not_Acquired'),
      );
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 100ms
      return this.getSettingValue(key); // Retry the whole process
    }
  }

  /**
   * Upserts a setting by its key. If a setting with the specified key exists, it updates its value; otherwise, it creates a new setting with the provided key and value.
   * It invalidates the cache upon successful database update.
   * @param key setting key
   * @param value setting value
   * @returns The upserted setting document.
   */
  async setSettingValue(
    key: string,
    value: Setting['value'],
  ): Promise<Setting> {
    const updatedSetting = await this.settingsRepository.upsert(key, value);
    const cacheKey = this.getCacheKey(key);

    // Invalidate cache, but don't let a Redis failure break the whole operation.
    // The breaker will prevent repeated attempts if Redis is down.
    this.redisBreaker.fire('del', cacheKey).catch((error) => {
      this.logger.error(
        { err: error, key, breakerState: this.redisBreaker.stats },
        this.i18nService.translate('Cache_Invalidate_Failed'),
      );
    });

    return updatedSetting;
  }

  private async _loadAllSettingsToCache(): Promise<void> {
    const allSettings = await this.settingsRepository.find({});
    if (!allSettings || allSettings.length === 0) {
      this.logger.info('No settings found in database to cache.');
      return;
    }

    const msetPayload: (string | number | Buffer)[] = [];
    const keysToSetTTL: string[] = [];

    for (const setting of allSettings) {
      const cacheKey = this.getCacheKey(setting._id);
      // Ensure value is a string for mset. Objects/arrays are stringified.
      const valueToCache =
        typeof setting.value === 'object' && setting.value !== null
          ? JSON.stringify(setting.value)
          : String(setting.value);

      msetPayload.push(cacheKey, valueToCache);
      keysToSetTTL.push(cacheKey);
    }

    // Use mset for bulk insertion, wrapped in the circuit breaker.
    await this.redisBreaker.fire('mset', msetPayload);

    // Set TTL for each key individually after successful mset.
    const ttlPromises = keysToSetTTL.map((key) => {
      const ttl = this.CACHE_TTL_SECONDS + Math.floor(Math.random() * 300);
      return this.redisBreaker.fire('expire', key, ttl);
    });
    await Promise.all(ttlPromises);
  }
}
