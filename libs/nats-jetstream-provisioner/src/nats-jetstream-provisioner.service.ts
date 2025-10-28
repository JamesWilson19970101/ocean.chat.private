import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { connect, JetStreamManager, NatsConnection } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { NATS_JETSTREAM_PROVISIONER_OPTIONS } from './constants';
import { NatsJetStreamProvisionerOptions } from './interfaces/nats-jetstream-provisioner-options.interface';

@Injectable()
export class NatsJetStreamProvisionerService implements OnModuleInit {
  constructor(
    @Inject(NATS_JETSTREAM_PROVISIONER_OPTIONS)
    private readonly options: NatsJetStreamProvisionerOptions,
    @InjectPinoLogger('nats-jetstream-provisioner.module')
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureStream();
  }

  private async ensureStream(): Promise<void> {
    const { natsUrl, streamConfig } = this.options;
    const streamName = streamConfig.name;

    if (!streamName) {
      const errorMsg = 'Stream name is required in streamConfig.';
      this.logger.error({ streamName: null }, errorMsg);
      throw new Error(errorMsg);
    }

    let nc: NatsConnection | undefined;

    try {
      this.logger.info(
        {
          natsUrl,
          streamName,
        },
        `Connecting to NATS at ${natsUrl} to provision stream '${streamName}'...`,
      );

      nc = await connect({ servers: natsUrl });
      const jsm: JetStreamManager = await nc.jetstreamManager();
      const streamInfo = await jsm.streams.info(streamName).catch(() => null);
      if (streamInfo) {
        this.logger.info(
          streamInfo,
          `Stream '${streamName}' found. Updating configuration...`,
        );
        await jsm.streams.update(streamName, streamConfig);
      } else {
        this.logger.info(
          { streamInfo: null },
          `Stream '${streamName}' not found. Creating...`,
        );
        await jsm.streams.add(streamConfig);
      }
    } catch (error) {
      this.logger.error(
        { error },
        `Failed to provision JetStream stream '${streamName}'.`,
      );
      throw error;
    } finally {
      await nc?.close();
    }
  }
}
