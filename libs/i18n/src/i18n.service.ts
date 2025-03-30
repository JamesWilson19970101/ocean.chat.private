import { Injectable, Logger } from '@nestjs/common';
import * as i18next from 'i18next';
import { TOptions } from 'i18next';

import translate from './translate';

@Injectable()
export class I18nService {
  private readonly logger = new Logger('i18n.i18n.module');

  constructor() {}

  async init() {
    try {
      await i18next.init({
        lng: 'zh', // default language
        fallbackLng: 'en', // fallbackLng
        resources: {
          ...translate,
        },
      });
      this.logger.log('I18nService initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to initialize I18nService.', error);
      throw error; // Re-throw the error to prevent the application from starting with a broken i18n setup}
    }
  }

  translate(key: string, options?: TOptions) {
    return i18next.t(key, options);
  }
}
