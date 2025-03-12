import { Global, Module, DynamicModule } from '@nestjs/common';
import { I18nService } from './i18n.service';
import {
  I18nModule as NestJsI18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
  CookieResolver,
} from 'nestjs-i18n';

import { type I18nOptions } from './i18n.interface';
import { DEFAULT_FALLBACK_LANGUAGE, DEFAULT_I18N_PATH } from './i18n.constants';

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
        NestJsI18nModule.forRootAsync({
          // TODO: use settings to switch language
          resolvers: [
            { use: QueryResolver, options: { queryParameter: 'lang' } }, // Corrected QueryResolver
            new CookieResolver(),
            new AcceptLanguageResolver(), // Corrected AcceptLanguageResolver
            { use: HeaderResolver, options: { header: 'x-lang' } }, // Corrected HeaderResolver
          ],
          useFactory: () => ({
            fallbackLanguage:
              options.fallbackLanguage || DEFAULT_FALLBACK_LANGUAGE,
            loaderOptions: {
              path: options.path || DEFAULT_I18N_PATH,
              watch: true,
            },
          }),
        }),
      ],
    };
  }
}
