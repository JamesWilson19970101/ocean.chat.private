import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes, InfrastructureException } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AckPolicy, connect, ConsumerConfig, JetStreamClient, JsMsg, NatsConnection } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { OceanchatMessagePersistenceWorkerService } from './oceanchat-message-persistence-worker.service';

/**
 * Custom batch subscriber for message persistence.
 * Uses JetStream's fetch() API to pull messages in chunks for efficient MongoDB BulkWrite.
 */
@Injectable()
export class NatsOrchestrateSubscriber implements OnModuleInit, OnModuleDestroy {
  private nc: NatsConnection | undefined;
  private js: JetStreamClient | undefined;
  private isShuttingDown = false;

  private readonly streamName = 'IM_HANDOFF';
  private readonly durableName = 'oceanchat-message-persistence-worker';

  constructor(
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
    @InjectPinoLogger('worker.nats-orchestrate')
    private readonly logger: PinoLogger,
    private readonly persistenceService: OceanchatMessagePersistenceWorkerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const natsUrl = this.configService.get<string>('nats.url', 'nats://localhost:4222');

    try {
      this.nc = await connect({ servers: natsUrl });
      this.js = this.nc.jetstream();
      const jsm = await this.nc.jetstreamManager();

      const config: Partial<ConsumerConfig> = {
        durable_name: this.durableName,
        ack_policy: AckPolicy.Explicit,
        filter_subject: 'im.orchestrate.msg',
        max_deliver: 5,
        max_ack_pending: 2000,
      };

      try {
        await jsm.consumers.add(this.streamName, config);
        this.logger.info(`Consumer ${this.durableName} successfully bound to ${this.streamName}`);
      } catch (err) {
        this.logger.error({ err }, 'Failed to add NATS consumer');
        throw new InfrastructureException(
          'Failed to add consumer',
          ErrorCodes.SERVICE_UNAVAILABLE,
          500,
        );
      }

      // Start the batch pulling loop
      this.startBatchPulling().catch((err) => {
        this.logger.error({ err }, 'Fatal error in batch pulling loop');
      });
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to NATS');
    }
  }

  private async startBatchPulling(): Promise<void> {
    if (!this.js) return;

    try {
      const consumer = await this.js.consumers.get(this.streamName, this.durableName);

      while (!this.isShuttingDown) {
        try {
          // Fetch up to 500 messages, waiting up to 1 second
          const messages = await consumer.fetch({ max_messages: 500, expires: 1000 });
          
          const batch: JsMsg[] = [];
          for await (const m of messages) {
            batch.push(m);
          }

          if (batch.length > 0) {
            this.logger.debug(`Pulled batch of ${batch.length} messages for persistence.`);
            await this.persistenceService.processBatch(batch);
          }
        } catch (err: any) {
          // 408 is thrown by fetch() when timeout occurs and no messages are available. This is expected.
          if (err.code !== '408') {
            this.logger.error({ err }, 'Error during NATS fetch');
            // Add a small delay to prevent tight error loops
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to retrieve consumer for pulling');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    try {
      await this.nc?.drain();
      await this.nc?.close();
    } catch (err) {
      this.logger.error({ err }, 'Error during NATS shutdown');
    }
  }
}
