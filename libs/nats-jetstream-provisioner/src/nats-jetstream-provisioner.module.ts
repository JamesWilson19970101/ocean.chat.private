import { DynamicModule, Module, Provider } from '@nestjs/common';

import { NATS_JETSTREAM_PROVISIONER_OPTIONS } from './constants';
import { NatsJetStreamProvisionerAsyncOptions } from './interfaces/nats-jetstream-provisioner-options.interface';
import { NatsJetStreamProvisionerService } from './nats-jetstream-provisioner.service';
import { BoundedPublisherService } from './nats-jetstream-publisher';

@Module({})
export class NatsJetStreamProvisionerModule {
  static forRootAsync(
    options: NatsJetStreamProvisionerAsyncOptions,
  ): DynamicModule {
    const providers: Provider[] = this.createAsyncProviders(options);
    return {
      module: NatsJetStreamProvisionerModule,
      imports: options.imports || [],
      providers: [
        ...providers,
        NatsJetStreamProvisionerService,
        BoundedPublisherService,
      ],
      exports: [NatsJetStreamProvisionerService, BoundedPublisherService],
    };
  }
  private static createAsyncProviders(
    options: NatsJetStreamProvisionerAsyncOptions,
  ): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: NATS_JETSTREAM_PROVISIONER_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }
    return [];
  }
}
