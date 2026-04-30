import { Injectable } from '@nestjs/common';
import * as i18n from 'i18next';
import { TOptions } from 'i18next';

const i18next = i18n.default || i18n;

@Injectable()
export class I18nService {
  /**
   * Translates a key using i18next.
   * Maintains backward compatibility with existing callers.
   */
  translate(key: string, options?: TOptions) {
    return i18next.t(key, options);
  }

  /**
   * Returns the current language.
   */
  get language(): string {
    return i18next.language;
  }

  /**
   * Changes the language dynamically.
   */
  async changeLanguage(lng: string): Promise<void> {
    await i18next.changeLanguage(lng);
  }
}
