import { Injectable } from '@nestjs/common';
import * as i18next from 'i18next';
import { TOptions } from 'i18next';

@Injectable()
export class I18nService {
  translate(key: string, options?: TOptions) {
    return i18next.t(key, options);
  }

  getI18next() {
    return i18next;
  }
}
