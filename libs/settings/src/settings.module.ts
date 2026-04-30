import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { SettingsModuleOptions } from '@ocean.chat/types';

import { SETTINGS_OPTIONS } from './constants';
import { SettingsService } from './settings.service';

@Global()
@Module({})
export class SettingsModule {
  static register(options: SettingsModuleOptions = {}): DynamicModule {
    const optionsProvider: Provider = {
      provide: SETTINGS_OPTIONS,
      useValue: {
        runSeeds: options.runSeeds || false, // Default to false for safety
      },
    };
    return {
      module: SettingsModule,
      imports: [],
      providers: [SettingsService, optionsProvider],
      exports: [SettingsService],
    };
  }
}
