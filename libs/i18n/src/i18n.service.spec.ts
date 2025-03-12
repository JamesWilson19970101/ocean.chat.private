import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from './i18n.service';
import {
  I18nModule as NestJsI18nModule,
  I18nContext,
  QueryResolver,
  HeaderResolver,
  CookieResolver,
  AcceptLanguageResolver,
} from 'nestjs-i18n';
import { DEFAULT_FALLBACK_LANGUAGE, DEFAULT_I18N_PATH } from './i18n.constants';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        NestJsI18nModule.forRootAsync({
          resolvers: [
            { use: QueryResolver, options: { queryParameter: 'lang' } },
            new CookieResolver(),
            new AcceptLanguageResolver(),
            { use: HeaderResolver, options: { header: 'x-lang' } },
          ],
          useFactory: () => ({
            fallbackLanguage: DEFAULT_FALLBACK_LANGUAGE,
            loaderOptions: {
              path: DEFAULT_I18N_PATH,
              watch: true,
            },
          }),
        }),
      ],
      providers: [I18nService],
    }).compile();

    service = module.get<I18nService>(I18nService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setI18nPath', () => {
    it('should set the i18n path', () => {
      const newPath = '/new/path';
      service.setI18nPath(newPath);
      expect(service.getI18nPath()).toBe(newPath);
    });
  });

  describe('getI18nPath', () => {
    it('should get the i18n path', () => {
      expect(service.getI18nPath()).toBe(
        '/home/seconp/ocean.chat.private/libs/i18n/src/i18n/',
      );
    });
  });

  describe('tranlate', () => {
    it('should translate a key', () => {
      jest.spyOn(I18nContext, 'current').mockReturnValue({
        lang: 'zh-CN',
      } as any);
      const translated = service.translate('HELLO');
      expect(translated).toBe('你好！');
    });
  });
});
