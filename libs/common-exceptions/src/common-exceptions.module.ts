import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { I18nService } from '@ocean.chat/i18n';
import { PinoLogger } from 'nestjs-pino';

import { AllExceptionsFilter } from './filters/all-exceptions.filter';
export const SERVICE_NAME = 'SERVICE_NAME';
export const SERVICE_INSTANCE_ID = 'SERVICE_INSTANCE_ID';

export interface CommonExceptionModuleOptions {
  serviceName: string;
  serviceInstanceId: string;
}

@Module({})
export class CommonExceptionsModule {
  /**
   * Registers the CommonExceptionsModule with the given options.
   * @param options CommonExceptionModuleOptions
   * @returns DynamicModule
   */
  static forRoot(options: CommonExceptionModuleOptions): DynamicModule {
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
      ],
      exports: [serviceNameProvider, serviceInstanceIdProvider],
    };
  }
}
