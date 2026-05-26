import { DynamicModule, Global, Module, Provider } from '@nestjs/common';

import { SETTINGS_OPTIONS } from './constants';
import { SettingsService } from './settings.service';

@Global()
@Module({})
export class SettingsModule {
  static register(): DynamicModule {
    const optionsProvider: Provider = {
      provide: SETTINGS_OPTIONS,
      useValue: {},
    };
    return {
      module: SettingsModule,
      imports: [],
      providers: [SettingsService, optionsProvider],
      exports: [SettingsService],
    };
  }
}
