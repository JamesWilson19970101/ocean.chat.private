import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';

import { AllExceptionsFilter } from './filters/all-exceptions.filter';
export const SERVICE_NAME = 'SERVICE_NAME';

export interface CommonExceptionModuleOptions {
  serviceName: string;
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

    return {
      module: CommonExceptionsModule,
      providers: [
        serviceNameProvider,
        {
          // register a global exception filter
          provide: APP_FILTER,
          useFactory: (serviceName: string, logger: PinoLogger) => {
            return new AllExceptionsFilter(serviceName, logger);
          },
          inject: [SERVICE_NAME, PinoLogger],
        },
      ],
      exports: [serviceNameProvider],
    };
  }
}
