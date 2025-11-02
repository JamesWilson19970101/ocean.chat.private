import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NatsOpentelemetryTracingModule } from '@ocean.chat/nats-opentelemetry-tracing';

import { UsersService } from './users.service';

@Module({
  imports: [
    // Use NatsOpentelemetryTracingModule to get an
    // instrumented NATS client that supports distributed tracing.
    // This module exports the client, making it available for injection.
    NatsOpentelemetryTracingModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        // The factory returns the options for the underlying NATS client
        servers: [configService.get<string>('nats.url') as string],
      }),
      inject: [ConfigService], // Inject ConfigService into the factory
    }),
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
