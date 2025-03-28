import { Injectable, Logger } from '@nestjs/common';
import * as i18next from 'i18next';
import { TFunction } from 'i18next';

import translate from './translate';

@Injectable()
export class I18nService {
  private t: TFunction;
  private readonly logger = new Logger('i18n.module');

  constructor() {
    void this.initializeI18next();
  }

  private async initializeI18next(): Promise<void> {
    try {
      // i18next.init returns a Promise.  Await it!
      await i18next.init({
        lng: 'zh',
        fallbackLng: 'en',
        resources: {
          ...translate,
        },
      });

      this.t = i18next.t.bind(i18next);
      this.logger.log('i18next initialized successfully.');
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
