import { ModuleMetadata } from '@nestjs/common';
import { StreamConfig } from 'nats';

export interface NatsJetStreamProvisionerOptions {
  /** NATS server URL(s) */
  natsUrl: string;
  /** The configuration for the streams to be created or updated. */
  streamConfigs: Partial<StreamConfig>[];
}

export interface NatsJetStreamProvisionerAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) =>
    | Promise<NatsJetStreamProvisionerOptions>
    | NatsJetStreamProvisionerOptions;
  inject?: any[];
}
