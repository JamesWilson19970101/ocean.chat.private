import { Injectable, OnModuleInit } from '@nestjs/common';
import * as i18next from 'i18next';
import { TOptions } from 'i18next';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import translate from './translate';

@Injectable()
export class I18nService implements OnModuleInit {
  private isInitialized = false;

  constructor(
    @InjectPinoLogger('i18n.module')
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit() {
    await this.init();
  }

  async init() {
    if (this.isInitialized) {
      return;
    }

    try {
      await i18next.init({
        lng: 'zh', // default language
        fallbackLng: 'en', // fallbackLng
        resources: {
          ...translate,
        },
        returnObjects: false, // Ensure t() returns a string even if key not found
        interpolation: { escapeValue: false },
      });
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize I18nService.', error);
      throw error; // Re-throw the error to prevent the application from starting with a broken i18n setup}
    }
  }

  translate(key: string, options?: TOptions) {
    return i18next.t(key, options);
  }
}
