import { ModuleMetadata } from '@nestjs/common';
import { StreamConfig } from 'nats';

export interface NatsJetStreamProvisionerOptions {
  /** NATS server URL(s) */
  natsUrl: string;
  /** The configuration for the stream to be created or updated. */
  streamConfig: Partial<StreamConfig>;
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
