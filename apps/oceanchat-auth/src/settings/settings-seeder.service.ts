import { Injectable, OnModuleInit } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import { RedisService } from '@ocean.chat/redis';
import { defaultSettings, SettingsService } from '@ocean.chat/settings';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class SettingsSeederService implements OnModuleInit {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly redisService: RedisService,
    private readonly i18nService: I18nService,
    @InjectPinoLogger(SettingsSeederService.name)
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const lockKey = 'seeder:lock:settings';
    const lockToken = uuidv7();
    const lockTtlSeconds = 60;

    // Distributes lock to ensure only one pod seeds settings
    const isLockAcquired = await this.redisService.setnx(
      lockKey,
      lockToken,
      lockTtlSeconds,
    );

    if (isLockAcquired !== 'OK') {
      this.logger.info(
        'Another instance is currently seeding settings. Skipping...',
      );
      return;
    }

    this.logger.info(
      this.i18nService.translate('Initializing_Default_Settings'),
    );

    let watchdogTimer: NodeJS.Timeout | undefined;

    try {
      // Watchdog mechanism: If the execution time is too long,
      // the lock is automatically renewed every half of lockTtlSeconds to prevent the lock from being released prematurely.
      watchdogTimer = setInterval(
        () => {
          this.redisService.expire(lockKey, lockTtlSeconds).catch((err) => {
            this.logger.error(
              { err, lockKey },
              'Watchdog failed to renew lock TTL',
            );
          });
          this.logger.debug(
            'Watchdog successfully renewed settings seeder lock',
          );
        },
        (lockTtlSeconds * 1000) / 2,
      );

      // 1. Seed to Database
      await this.settingsService.seedDefaultSettings(defaultSettings);
      this.logger.info(
        this.i18nService.translate('Default_Settings_Initialized'),
      );

      // 2. Pre-warm Redis cache for all other microservices to read
      this.logger.info(
        this.i18nService.translate('Initializing_Settings_Cache'),
      );
      await this.settingsService.warmUpCache();
      this.logger.info(
        this.i18nService.translate('Settings_Cache_Pre_Warming_Completed'),
      );
    } catch (error) {
      this.logger.error(
        { err: error },
        this.i18nService.translate('Default_Settings_Initialization_Failed'),
      );
    } finally {
      // TODO: Determine if manual intervention is needed
      // The watchdog timer stops immediately upon task completion (or exception throwing).
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
      }
      // Safely release the lock
      await this.redisService.delIfEqual(lockKey, lockToken).catch(() => {});
    }
  }
}
