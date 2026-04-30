import { Injectable } from '@nestjs/common';
import { AppException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { headers, MsgHdrs, StringCodec } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { NatsJetStreamProvisionerService } from './nats-jetstream-provisioner.service';

export interface PublishOptions {
  /**
   * If true, this task will use a reserved "emergency quota" in the queue
   * and is considered essential for system security (e.g., token revocation).
   */
  isCritical?: boolean;
  /**
   * Unique message ID for NATS JetStream deduplication (防 Publisher 重投)
   */
  msgId?: string;
}

/**
 * A lightweight, bounded asynchronous publisher service.
 * Protects the application from OOM (Out Of Memory) under extreme load.
 *
 * Features:
 * 1. Concurrency limit to prevent NATS/Network saturation.
 * 2. Bounded queue to prevent unbounded Promise accumulation in memory.
 * 3. Priority lane: Critical security signals have reserved capacity.
 */
@Injectable()
export class BoundedPublisherService {
  private activeCount = 0;
  private readonly queue: (() => void)[] = [];

  private readonly sc = StringCodec();

  // Max in-flight promises awaiting ACK
  private readonly concurrencyLimit = 100;

  // Backpressure thresholds
  private readonly maxNormalQueueSize = 5000;
  private readonly maxCriticalQueueSize = 10000;

  constructor(
    @InjectPinoLogger('bounded-publisher')
    private readonly logger: PinoLogger,
    private readonly natsProvisioner: NatsJetStreamProvisionerService,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Enqueues an asynchronous task with concurrency and memory protection.
   *
   * @param subject The NATS subject to publish to.
   * @param data The JSON-serializable data to publish.
   * @param context Context string for logging.
   * @param options Configuration for priority and error handling.
   * @returns A promise that resolves when the task is ENQUEUED, or rejects if queue is full.
   */
  async publishSafe(
    subject: string,
    data: Record<string, unknown>,
    context: string,
    options: PublishOptions = {},
  ): Promise<void> {
    const js = this.natsProvisioner.getJetStreamClient();
    if (!js) {
      const errorMsg = this.i18nService.translate(
        'BOUNDED_PUBLISHER_NOT_OPERATIONAL',
      );
      this.logger.error({ context, subject }, errorMsg);
      throw new AppException(errorMsg, ErrorCodes.SERVICE_UNAVAILABLE, 503);
    }

    const isCritical = options.isCritical ?? false;
    const currentQueueLength = this.queue.length;

    // Apply Quota Isolation
    const limit = isCritical
      ? this.maxCriticalQueueSize
      : this.maxNormalQueueSize;

    if (currentQueueLength >= limit) {
      const msg = isCritical
        ? this.i18nService.translate('CRITICAL_SECURITY_SIGNAL_DROPPED')
        : this.i18nService.translate('NORMAL_EVENT_DROPPED');

      this.logger.error(
        { context, queueLength: currentQueueLength, isCritical },
        msg,
      );

      // We still throw to allow the immediate caller to know the task failed to enqueue.
      // However, we handle this rejection in the business logic so it doesn't break responses.
      const throwMsg = this.i18nService.translate('QUEUE_LIMIT_REACHED', {
        msg,
      });
      throw new AppException(throwMsg, ErrorCodes.SERVICE_UNAVAILABLE, 503);
    }

    return new Promise<void>((resolve) => {
      // Logic to actually push the task into the execution pipeline
      this.queue.push(() => {
        this.activeCount++;

        const payload = this.sc.encode(JSON.stringify(data));
        const dlqSubject = `dlq.${subject}`;

        const pubOptions: { headers?: MsgHdrs } = {};
        if (options.msgId) {
          const h = headers();
          h.set('Nats-Msg-Id', options.msgId);
          pubOptions.headers = h;
        }

        js.publish(subject, payload, pubOptions)
          .catch((err) => {
            this.logger.error(
              { err, context, subject },
              this.i18nService.translate('BOUNDED_PUBLISHER_TASK_FAILED'),
            );
            // Attempt to publish to the dead-letter queue
            return js.publish(dlqSubject, payload).catch((dlqErr) => {
              this.logger.error(
                { err: dlqErr, context, dlqSubject },
                this.i18nService.translate('FATAL_FAILED_TO_PUBLISH_TO_DLQ'),
              );
            });
          })
          .finally(() => {
            this.activeCount--;
            this.processNext();
          });
      });

      // The call resolves once it is safely in the queue.
      resolve();

      // If we have capacity, start processing immediately
      if (this.activeCount < this.concurrencyLimit) {
        this.processNext();
      }
    });
  }

  private processNext(): void {
    if (this.queue.length > 0) {
      const nextTask = this.queue.shift();
      nextTask?.();
    }
  }
}
