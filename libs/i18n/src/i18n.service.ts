import { Injectable, Optional } from '@nestjs/common';
import { I18nContext, I18nService as NestJsI18nService } from 'nestjs-i18n';

import { type I18nOptions } from './i18n.interface';
import { DEFAULT_FALLBACK_LANGUAGE, DEFAULT_I18N_PATH } from './i18n.constants';

@Injectable()
export class I18nService {
  // TODO: add logger
  private fallbackLanguage: string;
  private i18nPath: string;

  constructor(
    private readonly nestJsI18nService: NestJsI18nService,
    @Optional() options: I18nOptions = {},
  ) {
    // default configuration
    this.fallbackLanguage =
      options.fallbackLanguage || DEFAULT_FALLBACK_LANGUAGE;
    this.i18nPath = options.path || DEFAULT_I18N_PATH;
  }

  /**
   * Dynamically set the path to the localization file
   * @param newPath - new path of json file
   */
  setI18nPath(newPath: string) {
    this.i18nPath = newPath;
  }

  translate(key: string): string {
    // get lang from resolver
    const currentContext = I18nContext.current();
    let lang = currentContext ? currentContext.lang : this.fallbackLanguage;
    console.log('lang is:', lang);
    console.log('key is:', key);
    lang = 'en';
    try {
      const a: string = this.nestJsI18nService.t('en.hello', {
        lang: lang,
      });
      console.log('---------------------------');
      console.log('a is', a);

      return a;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // TODO: add logger
      throw new Error(
        `Translation key "${key}" not found for language "${lang}".`,
      );
    }
  }

  /**
   * dynamically set language
   * @param newFallbackLanguage - language
   */
  setFallbackLanguage(newFallbackLanguage: 'zh-CN' | 'en') {
    // TODO: add logger
    this.fallbackLanguage = newFallbackLanguage;
  }

  /**
   * Get the current fallback language
   * @returns the current fallback language
   */
  getFallbackLanguage(): string {
    return this.fallbackLanguage;
  }

  /**
   * Get the current i18n path
   * @returns the current i18n path
   */
  getI18nPath(): string {
    return this.i18nPath;
  }
}
