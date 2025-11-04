import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { NatsOpentelemetryTracingAsyncOptions } from './interfaces/nats-opentelemetry-tracing-options.interface';
import { InstrumentedClientNats } from './lib/clients/instrumented-client-nats';
import { NatsTraceInterceptor } from './lib/interceptors/nats-trace.interceptor';

export const NATS_CLIENT_INJECTION_TOKEN = 'NATS_TRACING_CLIENT';

@Module({})
export class NatsOpentelemetryTracingModule {
  static registerAsync(
    options: (NatsOpentelemetryTracingAsyncOptions & { name: string })[],
  ): DynamicModule {
    return {
      module: NatsOpentelemetryTracingModule,
      imports: [
        ClientsModule.registerAsync(
          options.map((opt) => ({
            // Use the name provided in each option object, or a default.
            name: opt.name ?? NATS_CLIENT_INJECTION_TOKEN,
            imports: opt.imports,
            inject: opt.inject,
            useFactory: (...args: any[]) => ({
              transport: Transport.NATS,
              options: opt.useFactory(...args),
              customClass: InstrumentedClientNats,
            }),
          })),
        ),
      ],
      global: true,
      providers: [NatsTraceInterceptor],
      exports: [NatsTraceInterceptor, ClientsModule],
    };
  }
}
