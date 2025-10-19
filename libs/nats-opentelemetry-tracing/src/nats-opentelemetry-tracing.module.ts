import { DynamicModule, Module } from '@nestjs/common';
import { NatsOptions } from '@nestjs/microservices';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { InstrumentedClientNats } from './lib/clients/instrumented-client-nats';
import { NatsTraceInterceptor } from './lib/interceptors/nats-trace.interceptor';

export const NATS_CLIENT_INJECTION_TOKEN = 'NATS_TRACING_CLIENT';

@Module({})
export class NatsOpentelemetryTracingModule {
  static register(natsOptions: NatsOptions['options']): DynamicModule {
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
      exports: [NatsTraceInterceptor], // Export both the client and the interceptor
    };
  }
}
