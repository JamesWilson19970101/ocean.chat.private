import { DynamicModule, Module } from '@nestjs/common';
import * as i18next from 'i18next';
import { PinoLogger } from 'nestjs-pino';

import { I18nService } from './i18n.service';
import translate from './translate';

@Module({})
export class I18nModule {
  static forRoot(): DynamicModule {
    return {
      module: I18nModule,
      providers: [
        {
          provide: I18nService,
          useFactory: async (logger: PinoLogger): Promise<I18nService> => {
            logger.setContext('i18n.module');
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
            } catch (error) {
              logger.error({ err: error }, 'Failed to initialize I18nService.');
              throw error; // Re-throw the error to prevent the application from starting with a broken i18n setup
            }
            return new I18nService();
          },
          inject: [PinoLogger],
        },
      ],
      exports: [I18nService],
      global: true,
    };
  }
}
