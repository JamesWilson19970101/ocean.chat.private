import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { plainToInstance } from 'class-transformer';
import { validateOrReject, ValidationError } from 'class-validator';
import type { ConsumerInfo } from 'nats';
import {
  AckPolicy,
  connect,
  ConsumerConfig,
  JetStreamClient,
  JsMsg,
  NatsConnection,
  StringCodec,
} from 'nats';
import { PinoLogger } from 'nestjs-pino';

/**
 * Base abstract class for NATS JetStream Pull Consumers.
 * Provides standard lifecycle management, Zero-Trust validation, and error handling (DLQ support).
 */
export abstract class BaseNatsSubscriber<T extends object>
  implements OnModuleInit, OnModuleDestroy
{
  protected nc: NatsConnection | undefined;
  protected js: JetStreamClient | undefined;

  protected abstract readonly streamName: string;
  protected abstract readonly eventClass: new (...args: any[]) => T;
  protected abstract readonly logger: PinoLogger;
  protected abstract readonly configService: ConfigService;
  protected abstract readonly i18nService: I18nService;

  /**
   * Business logic implementation for processing the event.
   * If this method throws, the message will be NAK-ed (requeued) or moved to DLQ if max attempts reached.
   */
  protected abstract onEvent(event: T, msg: JsMsg): Promise<void>;

  /**
   * Optional durable name. If not provided, an ephemeral consumer will be created.
   * Ephemeral consumers are ideal for fan-out patterns (e.g., local cache invalidation).
   * Durable consumers are ideal for reliable processing (e.g., database updates).
   */
  protected durableName?: string;

  /**
   * Subclasses can override this to provide specific consumer configuration.
   * Default values for ack_policy (Explicit), max_deliver (3), and max_ack_pending (1000) are provided.
   */
  protected abstract getConsumerConfig(): Partial<ConsumerConfig>;

  async onModuleInit(): Promise<void> {
    const natsUrl = this.configService.get<string>('nats.url');
    if (!natsUrl) {
      this.logger.error(this.i18nService.translate('NATS_URL_NOT_FOUND'));
      return;
    }

    try {
      this.nc = await connect({
        servers: natsUrl,
        pingInterval: 10000,
        maxPingOut: 3, // No PONG forced disconnection and reconnection received 3 times consecutively
      });
      this.js = this.nc.jetstream();
      const jsm = await this.nc.jetstreamManager();

      const baseConfig: Partial<ConsumerConfig> = {
        ack_policy: AckPolicy.Explicit,
        max_deliver: 3,
        max_ack_pending: 1000,
      };

      const userConfig = this.getConsumerConfig();
      const finalConfig: Partial<ConsumerConfig> = {
        ...baseConfig,
        ...userConfig,
      };

      if (this.durableName) {
        finalConfig.durable_name = this.durableName;
      }

      let actualConsumerName: string;
      try {
        let consumerInfo: ConsumerInfo;
        if (this.durableName) {
          const existing = await jsm.consumers
            .info(this.streamName, this.durableName)
            .catch(() => null);

          if (existing) {
            try {
              // Attempt to gracefully apply new configuration (e.g., max_deliver updates)
              consumerInfo = await jsm.consumers.update(
                this.streamName,
                this.durableName,
                finalConfig,
              );
            } catch (updateErr) {
              this.logger.warn(
                { err: updateErr, durableName: this.durableName },
                this.i18nService.translate('FAILED_TO_UPDATE_CONSUMER_CONFIG'),
              );
              consumerInfo = existing;
            }
          } else {
            consumerInfo = await jsm.consumers.add(
              this.streamName,
              finalConfig,
            );
          }
        } else {
          // Ephemeral consumers always use add()
          consumerInfo = await jsm.consumers.add(this.streamName, finalConfig);
        }

        actualConsumerName = consumerInfo.name;
        this.logger.info(
          {
            streamName: this.streamName,
            consumerName: actualConsumerName,
            isDurable: !!this.durableName,
            filterSubject: finalConfig.filter_subject,
          },
          this.i18nService.translate('SUCCESSFULLY_PROCESSED_CONSUMER', {
            type: this.durableName ? 'durable' : 'ephemeral',
          }),
        );
      } catch (err) {
        const errorMsg = this.i18nService.translate('FAILED_TO_ADD_CONSUMER', {
          streamName: this.streamName,
        });
        this.logger.error(
          { err, streamName: this.streamName, config: finalConfig },
          errorMsg,
        );
        // Fail-Fast: Let the application crash and be restarted by orchestrator
        throw new AppException(errorMsg, ErrorCodes.SERVICE_UNAVAILABLE, 500, {
          cause: err,
        });
      }

      const consumer = await this.js.consumers.get(
        this.streamName,
        actualConsumerName,
      );
      const iter = await consumer.consume();
      const sc = StringCodec();

      void (async () => {
        for await (const m of iter) {
          try {
            const raw = sc.decode(m.data);
            const parsed = JSON.parse(raw) as unknown;

            // Normalize payload: handle both raw and NestJS-wrapped formats
            const rawPayload =
              parsed && typeof parsed === 'object' && 'data' in parsed
                ? (parsed as { data: unknown }).data
                : parsed;

            // Zero-Trust: Enforce strict class-based validation
            const event = plainToInstance(this.eventClass, rawPayload);
            await validateOrReject(event, {
              whitelist: true,
              forbidNonWhitelisted: true,
            });

            // Execute business logic
            await this.onEvent(event, m);

            // Explicitly ACK upon successful processing
            m.ack();
          } catch (e) {
            this.handleError(e, m);
          }
        }
      })().catch((err) => {
        this.logger.error(
          { err },
          this.i18nService.translate('PULL_CONSUMER_FATAL_ERROR'),
        );
      });
    } catch (error) {
      this.logger.error(
        { error, streamName: this.streamName },
        this.i18nService.translate('FAILED_TO_INITIALIZE_PULL_CONSUMER'),
      );
    }
  }

  /**
   * Standardized error handling for NATS messages.
   * Differentiates between malformed data (ACK and drop) and processing errors (NAK or DLQ).
   */
  protected handleError(e: any, m: JsMsg): void {
    const sc = StringCodec();
    const isValidationError =
      Array.isArray(e) && e[0] instanceof ValidationError;
    const isSyntaxError = e instanceof SyntaxError;
    const isMalformed = isValidationError || isSyntaxError;
    const deliveryCount = m.info?.deliveryCount || 1;

    this.logger.error(
      {
        err: e,
        isMalformed,
        deliveryCount,
        rawData: m.data ? sc.decode(m.data) : null,
        subject: m.subject,
      },
      isMalformed
        ? this.i18nService.translate('DISCARDING_MALFORMED_EVENT')
        : this.i18nService.translate('FAILED_TO_PROCESS_EVENT_REQUEUEING'),
    );

    if (isMalformed) {
      // Poison message: ACK to discard and prevent infinite retry loop.
      m.ack();
    } else if (deliveryCount >= (this.getConsumerConfig().max_deliver || 3)) {
      // TODO: Implement DLQ message processing strategy:
      // 1. Monitoring & Alerting: Trigger an alert (e.g., via metrics/logs) when a message lands in DLQ.
      // 2. Admin API: Build an endpoint in the Admin module to inspect, manually replay (remove 'dlq.' prefix and publish), or purge DLQ messages.
      // 3. Do NOT auto-consume DLQ: Wait for human or system intervention after the underlying issue is resolved.

      // Reached max delivery attempts. Route to Dead Letter Queue (DLQ).
      const dlqSubject = `dlq.${m.subject}`;
      this.js
        ?.publish(dlqSubject, m.data)
        .then(() => {
          this.logger.warn(
            { subject: m.subject, dlqSubject },
            this.i18nService.translate('MESSAGE_MOVED_TO_DLQ'),
          );
          m.ack(); // Remove from primary stream
        })
        .catch((dlqErr) => {
          this.logger.error(
            { err: dlqErr, subject: m.subject },
            this.i18nService.translate('FATAL_FAILED_TO_MOVE_TO_DLQ'),
          );
          m.nak();
        });
    } else {
      // Temporary failure: NAK to trigger NATS redelivery.
      m.nak();
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.nc?.drain();
      await this.nc?.close();
    } catch (err) {
      this.logger.error(
        { err },
        this.i18nService.translate('ERROR_DURING_NATS_SHUTDOWN'),
      );
    }
  }
}
