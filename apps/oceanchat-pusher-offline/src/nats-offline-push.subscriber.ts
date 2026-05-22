import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { BaseNatsSubscriber } from '@ocean.chat/nats-jetstream-provisioner';
import { OfflinePushEvent } from '@ocean.chat/types';
import { AckPolicy, JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OceanchatPusherOfflineService } from './oceanchat-pusher-offline.service';

@Injectable({ scope: Scope.DEFAULT })
export class NatsOfflinePushSubscriber extends BaseNatsSubscriber<OfflinePushEvent> {
  protected readonly streamName = 'OFFLINE_PUSH';
  protected readonly durableName = 'offline-pusher-group';
  protected readonly eventClass = OfflinePushEvent;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger('pusher.offline.nats')
    protected readonly logger: PinoLogger,
    private readonly offlinePusherService: OceanchatPusherOfflineService,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: 'push.offline.>',
      ack_policy: AckPolicy.Explicit, // Only ACK upon successful vendor delivery
      ack_wait: 10 * 1000 * 1000000, // 10 seconds in nanoseconds
      max_deliver: 3, // Retry up to 3 times before routing to DLQ
      // Using WorkQueue implicitly via consumer setup limits or by stream config,
      // but here we just configure the pull consumer attributes.
    };
  }

  protected async onEvent(event: OfflinePushEvent, msg: JsMsg): Promise<void> {
    try {
      // 1. Call vendor API
      await this.offlinePusherService.sendPushNotification(event);

      // 2. Explicit ACK
      // BaseNatsSubscriber will ACK automatically if we return without error.
      // But if we throw, it will NAK.
    } catch (error) {
      this.logger.error({ err: error, event }, 'Failed to deliver offline push notification');
      throw error; // Let BaseNatsSubscriber handle NAK and retries
    }
  }
}
