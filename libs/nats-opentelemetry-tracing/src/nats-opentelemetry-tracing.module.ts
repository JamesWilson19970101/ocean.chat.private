import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import {
  NatsOpentelemetryTracingAsyncOptions,
  NatsTracingOptions,
} from './interfaces/nats-opentelemetry-tracing-options.interface';
import { InstrumentedClientNats } from './lib/clients/instrumented-client-nats';
import { NatsTraceInterceptor } from './lib/interceptors/nats-trace.interceptor';

export const NATS_CLIENT_INJECTION_TOKEN = 'NATS_TRACING_CLIENT';

@Module({})
export class NatsOpentelemetryTracingModule {
  static register(natsOptions: NatsTracingOptions): DynamicModule {
    return {
      module: NatsOpentelemetryTracingModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: NATS_CLIENT_INJECTION_TOKEN,
            // eslint-disable-next-line @typescript-eslint/require-await
            useFactory: async () => ({
              transport: Transport.NATS,
              options: natsOptions,
              customClass: InstrumentedClientNats,
            }),
          },
        ]),
      ],
      providers: [NatsTraceInterceptor], // Provide the interceptor so it can be injected
      exports: [NatsTraceInterceptor],
    };
  }

  static registerAsync(
    options: NatsOpentelemetryTracingAsyncOptions,
  ): DynamicModule {
    return {
      module: NatsOpentelemetryTracingModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: NATS_CLIENT_INJECTION_TOKEN,
            imports: options.imports,
            inject: options.inject,
            useFactory: (...args: any[]) => ({
              transport: Transport.NATS,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              options: options.useFactory(...args),
              customClass: InstrumentedClientNats,
            }),
          },
        ]),
      ],
      providers: [NatsTraceInterceptor],
      exports: [NatsTraceInterceptor, ClientsModule],
    };
  }
}
