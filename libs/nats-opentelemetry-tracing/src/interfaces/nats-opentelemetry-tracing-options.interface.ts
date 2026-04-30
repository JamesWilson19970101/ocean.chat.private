import { ModuleMetadata } from '@nestjs/common';
import { NatsOptions } from '@nestjs/microservices';

export type NatsTracingOptions = NatsOptions['options'];

export interface NatsOpentelemetryTracingAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any
  ) => Promise<NatsTracingOptions> | NatsTracingOptions;

  inject?: any[];
}
