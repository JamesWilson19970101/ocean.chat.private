import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import { connect, JetStreamManager, NatsConnection } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { NATS_JETSTREAM_PROVISIONER_OPTIONS } from './constants';
import { NatsJetStreamProvisionerOptions } from './interfaces/nats-jetstream-provisioner-options.interface';

@Injectable()
export class NatsJetStreamProvisionerService
  implements OnModuleInit, OnModuleDestroy
{
  private nc: NatsConnection | undefined;

  constructor(
    @Inject(NATS_JETSTREAM_PROVISIONER_OPTIONS)
    private readonly options: NatsJetStreamProvisionerOptions,
    @InjectPinoLogger('nats-jetstream-provisioner.module')
    private readonly logger: PinoLogger,
    private readonly i18nService: I18nService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureStream();
  }

  async onModuleDestroy(): Promise<void> {
    await this.nc?.close();
  }

  private async ensureStream(): Promise<void> {
    const { natsUrl, streamConfig } = this.options;
    const streamName = streamConfig.name;

    if (!streamName) {
      const errorMsg = this.i18nService.translate('NATS_STREAM_NAME_REQUIRED');
      this.logger.error({ streamName }, errorMsg);
      throw new Error(errorMsg);
    }

    try {
      this.logger.info(
        {
          natsUrl,
          streamName,
        }, // Pass context for logging
        this.i18nService.translate('NATS_CONNECTING_TO_PROVISION_STREAM', {
          natsUrl,
          streamName,
        }),
      );

      this.nc = await connect({ servers: natsUrl });
      const jsm: JetStreamManager = await this.nc.jetstreamManager();
      const streamInfo = await jsm.streams.info(streamName).catch(() => null);
      if (streamInfo) {
        this.logger.info(
          { streamName, description: streamInfo.config.description },
          this.i18nService.translate('NATS_STREAM_FOUND_UPDATING', {
            streamName,
          }),
        );
        await jsm.streams.update(streamName, streamConfig);
      } else {
        this.logger.info(
          { streamName, streamInfo: null },
          this.i18nService.translate('NATS_STREAM_NOT_FOUND_CREATING', {
            streamName,
          }),
        );
        await jsm.streams.add(streamConfig);
      }
      this.logger.info(
        {
          natsUrl,
          streamName,
        },
        this.i18nService.translate('NATS_STREAM_PROVISIONED_SUCCESSFULLY', {
          streamName,
        }),
      );
    } catch (error) {
      this.logger.error(
        { streamName, error },
        `Failed to provision JetStream stream '${streamName}'.`,
      );
      throw error;
    }
  }
}
