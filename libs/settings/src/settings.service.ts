import { Inject, Injectable } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import type { Setting } from '@ocean.chat/models';
import { SettingsRepository } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import { SettingValue } from '@ocean.chat/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { SETTINGS_OPTIONS } from './constants';
import { DefaultSetting } from './default-settings';

@Injectable()
export class SettingsService {
  private readonly CACHE_KEY_PREFIX = 'settings:';
  // Cache TTLs(time to live) in seconds
  private readonly CACHE_TTL_SECONDS = 3600; // 1 hour
  private readonly CACHE_NULL_TTL_SECONDS = 300; // 5 minutes

  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly redisService: RedisService,
    @InjectPinoLogger('lib.settings.settings.service')
    private readonly logger: PinoLogger,
    private readonly i18nService: I18nService,
    @Inject(SETTINGS_OPTIONS) private readonly options,
  ) {}

  /**
   * Initializes default settings by iterating through the provided array.
   * Intended to be called by the application's specific Seeder service.
   */
  async seedDefaultSettings(defaultSettings: DefaultSetting[]) {
    for (const setting of defaultSettings) {
      await this.settingsRepository.createIfNotExists(setting);
    }
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
   * Retrieves the value of a setting by its key.
   * It implements the cache-aside pattern with Redis.
   * @param key setting key
   * @returns The value of the setting associated with the provided key, or null if no such setting exists.
   */
  async getSettingValue(
    key: string,
    retryOptions = { retries: 3, delay: 150 },
  ): Promise<Setting['value'] | null> {
    for (let i = 0; i < retryOptions.retries; i++) {
      const cacheKey = this.getCacheKey(key);

      const fetcher = async () => {
        this.logger.debug(
          { key, attempt: i + 1 },
          this.i18nService.translate('Trying_To_Get_Setting_From_DB', { key }),
        );
        const setting = await this.settingsRepository.findByKey(key);
        return setting ? setting.value : null;
      };

      const result = await this.redisService.getOrSet<SettingValue>(
        cacheKey,
        fetcher,
        {
          ttl: this.CACHE_TTL_SECONDS,
          nullTtl: this.CACHE_NULL_TTL_SECONDS,
          lockTtl: 10, // Lock expires after 10 seconds
          lockWaitTime: 100, // Wait for 100ms before retrying
          ttlJitter: 300, // Add up to 5 minutes of jitter
        },
      );

      if (result !== null) {
        if (typeof result === 'string') {
          try {
            return JSON.parse(result) as SettingValue;
          } catch {
            return result;
          }
        } else {
          return result;
        }
      }

      this.logger.warn(
        { key, attempt: i + 1, delay: retryOptions.delay },
        this.i18nService.translate('GET_OR_SET_RETURNED_NULL_RETRYING', {
          delay: retryOptions.delay,
        }),
      );
      await new Promise((resolve) =>
        setTimeout(resolve, retryOptions.delay * (i + 1)),
      ); // Exponential backoff
    }
    this.logger.error(
      { key },
      this.i18nService.translate('GET_SETTING_VALUE_FAILED_AFTER_RETRIES'),
    );
    return null;
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
    this.redisService.del(cacheKey).catch((error) => {
      this.logger.error(
        { err: error, key },
        this.i18nService.translate('Cache_Invalidate_Failed'),
      );
    });

    return updatedSetting;
  }

  /**
   * Pre-warms the Redis cache with all settings from the database.
   */
  async warmUpCache(): Promise<void> {
    const allSettings = await this.settingsRepository.find({});
    if (!allSettings || allSettings.length === 0) {
      this.logger.info(
        this.i18nService.translate('NO_SETTINGS_FOUND_TO_CACHE'),
      );
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
    await this.redisService.mset(msetPayload);

    // Set TTL for each key individually after successful mset.
    const ttlPromises = keysToSetTTL.map((key) => {
      const ttl = this.CACHE_TTL_SECONDS + Math.floor(Math.random() * 300);
      return this.redisService.expire(key, ttl);
    });
    await Promise.all(ttlPromises);
  }
}
