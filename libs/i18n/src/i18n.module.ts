import { DynamicModule, Module } from '@nestjs/common';

import { I18nService } from './i18n.service';

@Module({})
export class I18nModule {
  static forRoot(): DynamicModule {
    return {
      module: I18nModule,
      providers: [I18nService],
      exports: [I18nService],
      global: true,
    };
  }
}
