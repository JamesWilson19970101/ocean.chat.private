import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { I18nService } from '@ocean.chat/i18n';
import { MonkeyModule } from '@ocean.chat/monkey';
import { TracingOptions } from '@ocean.chat/types';
import { PinoLogger } from 'nestjs-pino';

import {
  SERVICE_INSTANCE_ID,
  SERVICE_NAME,
} from './constants/common-exceptions.constants';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { MonkeyWsExceptionFilter } from './filters/monkey-ws-exception.filter';

@Global()
@Module({})
export class CommonExceptionsModule {
  /**
   * Registers the CommonExceptionsModule with the given options.
   * @param options CommonExceptionModuleOptions
   * @returns DynamicModule
   */
  static forRoot(options: TracingOptions): DynamicModule {
    const serviceNameProvider: Provider = {
      provide: SERVICE_NAME,
      useValue: options.serviceName || 'UnknownService',
    };

    const serviceInstanceIdProvider: Provider = {
      provide: SERVICE_INSTANCE_ID,
      useValue: options.serviceInstanceId,
    };

    return {
      module: CommonExceptionsModule,
      global: true,
      imports: [MonkeyModule],
      providers: [
        serviceNameProvider,
        serviceInstanceIdProvider,
        {
          // register a global exception filter
          provide: APP_FILTER,
          useFactory: (
            serviceName: string,
            serviceInstanceId: string,
            logger: PinoLogger,
            i18nService: I18nService,
          ) => {
            return new AllExceptionsFilter(
              serviceName,
              serviceInstanceId,
              logger,
              i18nService,
            );
          },
          inject: [SERVICE_NAME, SERVICE_INSTANCE_ID, PinoLogger, I18nService],
        },
        MonkeyWsExceptionFilter,
      ],
      exports: [
        serviceNameProvider,
        serviceInstanceIdProvider,
        MonkeyWsExceptionFilter,
      ],
    };
  }
}
