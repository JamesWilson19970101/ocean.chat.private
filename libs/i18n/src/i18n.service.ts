import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as i18next from 'i18next';
import { TFunction } from 'i18next';

import translate from './translate';

@Injectable()
export class I18nService implements OnModuleInit {
  private t: TFunction;
  private readonly logger = new Logger(I18nService.name);

  constructor() {}

  async onModuleInit() {
    try {
      await i18next.init({
        lng: 'zh',
        fallbackLng: 'en',
        resources: {
          ...translate,
        },
      });

      this.t = i18next.t.bind(i18next);
      this.logger.log('i18next initialized successfully within onModuleInit.');
    } catch (error) {
      this.logger.error('Failed to initialize i18next:', error);
      throw error;
    }
  }

  translate(key: string, options?: i18next.TOptions): string {
    if (!this.t) {
      this.logger.error(
        `Translate called but i18next instance (t) is not available! Key: ${key}`,
      );
      return key;
    }
    return this.t(key, options);
  }
}
