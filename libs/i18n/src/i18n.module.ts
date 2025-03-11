import { Global, Module, DynamicModule } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { I18nModule as NestJsI18nModule } from 'nestjs-i18n';
import * as path from 'path';

import type { I18nOptions } from './i18n.service';

@Global()
@Module({
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {
  static forRoot(options: I18nOptions = {}): DynamicModule {
    return {
      module: I18nModule,
      imports: [
        NestJsI18nModule.forRoot({
          fallbackLanguage: options.fallbackLanguage || 'zh-CN',
          loaderOptions: {
            path: options.path || path.join(__dirname, 'i18n'),
            watch: true,
          },
        }),
      ],
    };
  }
}
