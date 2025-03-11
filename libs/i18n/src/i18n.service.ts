import { Injectable, Optional } from '@nestjs/common';
import { I18nContext, I18nService as NestJsI18nService } from 'nestjs-i18n';
import * as path from 'path';

export interface I18nOptions {
  path?: string;
  fallbackLanguage?: string;
}

@Injectable()
export class I18nService {
  private fallbackLanguage: string;
  private i18nPath: string;

  constructor(
    private readonly nestJsI18nService: NestJsI18nService,
    @Optional() options: I18nOptions = {},
  ) {
    // default configuration
    this.fallbackLanguage = options.fallbackLanguage || 'zh-CN';
    this.i18nPath = options.path || path.join(__dirname, 'i18n');
  }

  /**
   * Dynamically set the path to the localization file
   * @param newPath - new path of json file
   */
  setI18nPath(newPath: string) {
    this.i18nPath = newPath;
  }

  translate(key: string, options?: any): string {
    const currentContext = I18nContext.current();
    const lang = currentContext ? currentContext.lang : this.fallbackLanguage;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.nestJsI18nService.translate(key, {
      ...options,
      lang: lang,
    });
  }

  /**
   * dynamically set language
   * @param newFallbackLanguage - language
   */
  setFallbackLanguage(newFallbackLanguage: 'zh-CN' | 'en') {
    this.fallbackLanguage = newFallbackLanguage;
  }
}
