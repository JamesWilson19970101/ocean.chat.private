import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import {
  connect,
  JetStreamClient,
  JetStreamManager,
  NatsConnection,
} from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { NATS_JETSTREAM_PROVISIONER_OPTIONS } from './constants';
import { NatsJetStreamProvisionerOptions } from './interfaces/nats-jetstream-provisioner-options.interface';

@Injectable()
export class NatsJetStreamProvisionerService
  implements OnModuleInit, OnModuleDestroy
{
  private nc: NatsConnection | undefined;
  private js: JetStreamClient | undefined;

  constructor(
    @Inject(NATS_JETSTREAM_PROVISIONER_OPTIONS)
    private readonly options: NatsJetStreamProvisionerOptions,
    @InjectPinoLogger('nats-jetstream-provisioner.module')
    private readonly logger: PinoLogger,
    private readonly i18nService: I18nService,
  ) {}

  getJetStreamClient(): JetStreamClient | undefined {
    return this.js;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureStreams();
  }

  async onModuleDestroy(): Promise<void> {
    await this.nc?.close();
  }

  private async ensureStreams(): Promise<void> {
    const { natsUrl, streamConfigs } = this.options;

    if (!streamConfigs || streamConfigs.length === 0) {
      this.logger.warn(
        this.i18nService.translate('NO_STREAM_CONFIGS_PROVIDED'),
      );
      return;
    }

    try {
      this.logger.info(
        { natsUrl },
        this.i18nService.translate('NATS_CONNECTING_TO_PROVISION_STREAM', {
          natsUrl,
          streamName: 'Multiple Streams',
        }),
      );

      this.nc = await connect({
        servers: natsUrl,
        pingInterval: 10000,
        maxPingOut: 3, // No PONG forced disconnection and reconnection received 3 times consecutively
      });
      this.js = this.nc.jetstream();
      const jsm: JetStreamManager = await this.nc.jetstreamManager();

      for (const streamConfig of streamConfigs) {
        const streamName = streamConfig.name;

        if (!streamName) {
          const errorMsg = this.i18nService.translate(
            'NATS_STREAM_NAME_REQUIRED',
          );
          this.logger.error({ streamName, streamConfig }, errorMsg);
          throw new AppException(errorMsg, ErrorCodes.SERVICE_ERROR, 500);
        }

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
      }
    } catch (error) {
      const errorMsg = this.i18nService.translate(
        'FAILED_TO_PROVISION_JETSTREAM_STREAMS',
      );
      this.logger.error({ error }, errorMsg);
      throw new AppException(errorMsg, ErrorCodes.SERVICE_ERROR, 500, {
        cause: error,
      });
    }
  }
}
