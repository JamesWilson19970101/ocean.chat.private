import { Injectable, OnModuleInit } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import type { Setting } from '@ocean.chat/models';
import { SettingsRepository } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DefaultSetting, defaultSettings } from './default-settings';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly CACHE_KEY_PREFIX = 'setting:';
  // Cache TTLs(time to live) in seconds
  private readonly CACHE_TTL_SECONDS = 3600; // 1 hour
  private readonly CACHE_NULL_TTL_SECONDS = 300; // 5 minutes

  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly redisService: RedisService,
    @InjectPinoLogger('lib.settings.settings.service')
    private readonly logger: PinoLogger,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Initializes default settings when the module is loaded by iterating
   * through the `defaultSettings` array.
   * This ensures that essential settings are present in the database on first startup.
   * It also pre-warms the cache by loading all settings from the database into Redis.
   */
  async onModuleInit() {
    try {
      this.logger.info(
        this.i18nService.translate('Initializing_Default_Settings'),
      );
      for (const setting of defaultSettings) {
        await this.createDefaultSetting(setting);
      }
      this.logger.info(
        this.i18nService.translate('Default_Settings_Initialized'),
      );

      this.logger.info(
        this.i18nService.translate('Initializing_Settings_Cache'),
      );
      await this._loadAllSettingsToCache();
      this.logger.info(
        this.i18nService.translate('Settings_Cache_Pre_Warming_Completed'),
      );
    } catch (error) {
      this.logger.error(
        { err: error },
        this.i18nService.translate('Default_Settings_Initialization_Failed'),
      );
      throw error;
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

    const fetcher = async () => {
      this.logger.debug(
        { key },
        this.i18nService.translate('Trying_To_Get_Setting_From_DB', { key }),
      );
      const setting = await this.settingsRepository.findByKey(key);
      return setting ? setting.value : null;
    };

    return this.redisService.getOrSet(cacheKey, fetcher, {
      ttl: this.CACHE_TTL_SECONDS,
      nullTtl: this.CACHE_NULL_TTL_SECONDS,
      lockTtl: 10, // Lock expires after 10 seconds
      lockWaitTime: 100, // Wait for 100ms before retrying
      ttlJitter: 300, // Add up to 5 minutes of jitter
    });
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
    await this.redisService.mset(msetPayload);

    // Set TTL for each key individually after successful mset.
    const ttlPromises = keysToSetTTL.map((key) => {
      const ttl = this.CACHE_TTL_SECONDS + Math.floor(Math.random() * 300);
      return this.redisService.expire(key, ttl);
    });
    await Promise.all(ttlPromises);
  }
}
