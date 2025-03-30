import { DynamicModule, Module } from '@nestjs/common';

import { I18nService } from './i18n.service';

@Module({})
export class I18nModule {
  static forRoot(): DynamicModule {
    return {
      module: I18nModule,
      providers: [
        {
          provide: I18nService,
          useFactory: async () => {
            const i18nServiceInstance = new I18nService();
            await i18nServiceInstance.init();
            return i18nServiceInstance;
          },
        },
      ],
      exports: [I18nService],
      global: true,
    };
  }
}
